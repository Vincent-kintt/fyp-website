export const reminderKeys = {
  all: ["tasks"],
  lists: () => [...reminderKeys.all, "list"],
  list: (filters) => [...reminderKeys.lists(), filters],
};

export const noteKeys = {
  all: ["notes"],
  lists: () => [...noteKeys.all, "list"],
  detail: (id) => [...noteKeys.all, "detail", id],
};
