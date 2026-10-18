/**
 * Notification Store Tests (Zustand)
 * Tests fetch, mark-read, add notification, toggle, and WebSocket/polling
 */

// Mock the API module
vi.mock("../services/api", () => ({
  notificationAPI: {
    getAll: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

// Mock WebSocket
class MockWebSocket {
  constructor() {
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.close = vi.fn();
  }
}
global.WebSocket = MockWebSocket;

let useNotificationStore;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();

  const mod = await import("../store/notificationStore");
  useNotificationStore = mod.default || mod.useNotificationStore;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Notification Store", () => {
  it("starts with empty state", () => {
    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.unreadCount).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.isOpen).toBe(false);
  });

  it("fetches notifications and updates state", async () => {
    const { notificationAPI } = await import("../services/api");
    notificationAPI.getAll.mockResolvedValue({
      notifications: [{ _id: "n1", message: "Hello", status: "unread" }],
      unreadCount: 1,
    });

    await useNotificationStore.getState().fetchNotifications("u1");

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
    expect(state.isLoading).toBe(false);
  });

  it("marks a notification as read", async () => {
    const { notificationAPI } = await import("../services/api");
    notificationAPI.markRead.mockResolvedValue({});

    // Pre-populate state
    useNotificationStore.setState({
      notifications: [{ _id: "n1", status: "unread" }],
      unreadCount: 1,
    });

    await useNotificationStore.getState().markAsRead("n1");

    const state = useNotificationStore.getState();
    expect(state.notifications[0].status).toBe("read");
    expect(state.unreadCount).toBe(0);
    expect(notificationAPI.markRead).toHaveBeenCalledWith("n1");
  });

  it("marks all notifications as read", async () => {
    const { notificationAPI } = await import("../services/api");
    notificationAPI.markAllRead.mockResolvedValue({});

    useNotificationStore.setState({
      notifications: [
        { _id: "n1", status: "unread" },
        { _id: "n2", status: "unread" },
      ],
      unreadCount: 2,
    });

    await useNotificationStore.getState().markAllAsRead("u1");

    const state = useNotificationStore.getState();
    expect(state.notifications.every((n) => n.status === "read")).toBe(true);
    expect(state.unreadCount).toBe(0);
  });

  it("adds a new notification", () => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });

    useNotificationStore
      .getState()
      .addNotification({ _id: "n1", message: "New!", status: "unread" });

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
  });

  it("prepends new notifications", () => {
    useNotificationStore.setState({
      notifications: [{ _id: "n1", message: "Old" }],
      unreadCount: 0,
    });

    useNotificationStore
      .getState()
      .addNotification({ _id: "n2", message: "New!", status: "unread" });

    const state = useNotificationStore.getState();
    expect(state.notifications[0]._id).toBe("n2");
    expect(state.notifications).toHaveLength(2);
  });

  it("toggles notification center", () => {
    expect(useNotificationStore.getState().isOpen).toBe(false);
    useNotificationStore.getState().toggleNotificationCenter();
    expect(useNotificationStore.getState().isOpen).toBe(true);
    useNotificationStore.getState().toggleNotificationCenter();
    expect(useNotificationStore.getState().isOpen).toBe(false);
  });

  it("closes notification center", () => {
    useNotificationStore.setState({ isOpen: true });
    useNotificationStore.getState().closeNotificationCenter();
    expect(useNotificationStore.getState().isOpen).toBe(false);
  });

  it("handles fetch error gracefully", async () => {
    const { notificationAPI } = await import("../services/api");
    notificationAPI.getAll.mockRejectedValue(new Error("Network fail"));

    await useNotificationStore.getState().fetchNotifications("u1");

    const state = useNotificationStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeTruthy();
  });
});
