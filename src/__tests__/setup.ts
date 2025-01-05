import "jest";

declare global {
  // Override the fetch function type for tests
  function fetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response>;
}

// Initialize the mock
global.fetch = jest.fn() as jest.Mock<Promise<Response>>;
