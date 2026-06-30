jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn(() => jest.fn()),
}));

jest.mock('webdav', () => ({
  createClient: jest.fn(),
}));
