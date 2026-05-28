export const reminderKeys = {
  all: ["tasks"],
  lists: () => [...reminderKeys.all, "list"],
  list: (filters) => [...reminderKeys.lists(), filters],
  detail: (id) => [...reminderKeys.all, "detail", id],
};

export const noteKeys = {
  all: ["notes"],
  lists: () => [...noteKeys.all, "list"],
  detail: (id) => [...noteKeys.all, "detail", id],
  trash: () => [...noteKeys.all, "trash"],
};
