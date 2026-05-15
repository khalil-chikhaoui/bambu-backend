import { jest } from '@jest/globals'; 
import jwt from "jsonwebtoken";
import { generateToken } from "../../src/middlewares/auth.js";

describe("Auth Middlewares", () => {
  // Set up a fake environment variable before tests run
  beforeAll(() => {
    process.env.JWT_SECRET = "super_secret_test_key";
  });

  // Restore any mocks after tests finish
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("generateToken()", () => {
    it("should fail this test on purpose to check the CI gate", () => {
      const token = generateToken("12345", false);
      
      // We know the token is a string, but we will tell Jest to expect a number.
      // This will cause a crash! Easy to fix later by changing "number" back to "string".
      expect(typeof token).toBe("number"); 
    });
    it("should generate a valid JWT token containing the user ID", () => {
      const userId = "12345abcde";
      const token = generateToken(userId, false);
      
      // Decode the token to see if it holds our ID
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      expect(typeof token).toBe("string");
      expect(decoded.id).toBe(userId);
    });

    it("should set lifespan to 2h if rememberMe is false", () => {
      // We "spy" on the jwt.sign method to see what arguments it was called with
      const signSpy = jest.spyOn(jwt, "sign");
      
      generateToken("12345abcde", false);

      expect(signSpy).toHaveBeenCalledWith(
        { id: "12345abcde" },
        process.env.JWT_SECRET,
        { expiresIn: "2h" } // Checks your specific logic!
      );
    });

    it("should set lifespan to 30d if rememberMe is true", () => {
      const signSpy = jest.spyOn(jwt, "sign");
      
      generateToken("12345abcde", true);

      expect(signSpy).toHaveBeenCalledWith(
        { id: "12345abcde" },
        process.env.JWT_SECRET,
        { expiresIn: "30d" } // Checks the true condition
      );
    });
  });
});