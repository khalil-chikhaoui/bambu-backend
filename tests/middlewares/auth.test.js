import { jest } from '@jest/globals';
import jwt from "jsonwebtoken";
import { generateToken, protect } from "../../src/middlewares/auth.js";
import User from "../../src/models/User.js";

describe("Auth Middlewares", () => {
  // 1. Setup fake Express objects before every test
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset req, res, and next for every single test so they don't interfere
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // Set up a fake environment variable before tests run
  beforeAll(() => {
    process.env.JWT_SECRET = "super_secret_test_key";
  });

  // Restore any mocks after tests finish so we don't break other files
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================
  // TESTS FOR generateToken()
  // ==========================================
  describe("generateToken()", () => {
    it("should generate a valid JWT token containing the user ID", () => {
      const userId = "12345abcde";
      const token = generateToken(userId, false);
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      expect(typeof token).toBe("string");
      expect(decoded.id).toBe(userId);
    });

    it("should set lifespan to 2h if rememberMe is false", () => {
      const signSpy = jest.spyOn(jwt, "sign");
      generateToken("12345abcde", false);

      expect(signSpy).toHaveBeenCalledWith(
        { id: "12345abcde" },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );
    });

    it("should set lifespan to 30d if rememberMe is true", () => {
      const signSpy = jest.spyOn(jwt, "sign");
      generateToken("12345abcde", true);

      expect(signSpy).toHaveBeenCalledWith(
        { id: "12345abcde" },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );
    });
  });

  // ==========================================
  // TESTS FOR protect() MIDDLEWARE
  // ==========================================
  describe("protect()", () => {
    it("should call next() and attach user to req if token is valid", async () => {
      // Arrange: Fake a valid token in the headers
      req.headers.authorization = "Bearer valid_test_token";
      const mockUser = { _id: "12345abcde", email: "test@test.com" };
      
      // Spy on jwt.verify to pretend the token is good
      jest.spyOn(jwt, "verify").mockReturnValue({ id: "12345abcde" });
      
      // Spy on User.findById to pretend we found the user in the database
      // Because your code uses .select("-password"), we must chain our mock!
      jest.spyOn(User, "findById").mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      // Act: Run the middleware
      await protect(req, res, next);

      // Assert: Did it do its job correctly?
      expect(jwt.verify).toHaveBeenCalledWith("valid_test_token", process.env.JWT_SECRET);
      expect(User.findById).toHaveBeenCalledWith("12345abcde");
      expect(req.user).toEqual(mockUser); // The user profile should now be attached
      expect(next).toHaveBeenCalledTimes(1); 
      expect(next).toHaveBeenCalledWith(); // next() called with no errors
    });

    it("should fail with 401 if no token is provided", async () => {
      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      // Because of express-async-handler, thrown errors are passed to next()
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe("Not authorized, no token");
    });

    it("should fail with 401 if token is invalid or expired", async () => {
      req.headers.authorization = "Bearer bad_token";
      
      // Force jwt.verify to throw an error simulating a bad token
      jest.spyOn(jwt, "verify").mockImplementation(() => {
        throw new Error("jwt expired");
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe("Not authorized, token failed");
    });

    it("should fail with 401 if token is valid but user was deleted from DB", async () => {
      req.headers.authorization = "Bearer valid_test_token";
      
      jest.spyOn(jwt, "verify").mockReturnValue({ id: "12345abcde" });
      
      // Mock the DB returning null (user not found)
      jest.spyOn(User, "findById").mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await protect(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe("Not authorized, user not found");
    });
  });
});