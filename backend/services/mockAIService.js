
// Local rule-based Mock AI service
// No external API or paid credits required.

const parseContext = (context) => {
  if (!context) return {};

  if (typeof context === "object") return context;

  try {
    return JSON.parse(context);
  } catch {
    return {};
  }
};

const formatDate = (value) => {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};

const summarizeTasks = (tasks = []) => {
  if (!tasks.length) {
    return "No task records are currently available.";
  }

  const counts = {};

  tasks.forEach((task) => {
    counts[task.status] = (counts[task.status] || 0) + 1;
  });

  return [
    `Total tasks: ${tasks.length}`,
    `Assigned: ${counts.assigned || 0}`,
    `Awaiting verification: ${counts.pending_verification || 0}`,
    `Approved: ${counts.approved || 0}`,
    `Completed: ${counts.completed || 0}`,
    `Closed: ${counts.closed || 0}`
  ].join("\n");
};

const summarizeAttendance = (attendance = []) => {
  if (!attendance.length) {
    return "No attendance records are currently available.";
  }

  const counts = {};

  attendance.forEach((record) => {
    counts[record.status] = (counts[record.status] || 0) + 1;
  });

  return [
    `Total attendance records: ${attendance.length}`,
    `Present: ${counts.present || 0}`,
    `Late: ${counts.late || 0}`,
    `Absent: ${counts.absent || 0}`
  ].join("\n");
};

const summarizeBookings = (bookings = []) => {
  if (!bookings.length) {
    return "No booking records are currently available.";
  }

  const counts = {};

  bookings.forEach((booking) => {
    counts[booking.status] = (counts[booking.status] || 0) + 1;
  });

  return [
    `Total bookings: ${bookings.length}`,
    `Pending: ${counts.pending || 0}`,
    `Approved: ${counts.approved || 0}`,
    `Rejected: ${counts.rejected || 0}`,
    `Cancelled: ${counts.cancelled || 0}`
  ].join("\n");
};

export const askMockAI = async (prompt, context = {}) => {
  const data = parseContext(context);

  const question = prompt.toLowerCase();

  const tasks = data.tasks || [];
  const attendance = data.attendance || [];
  const bookings = data.bookings || [];

  // Task-related questions
  if (
    question.includes("task") ||
    question.includes("work") ||
    question.includes("pending") ||
    question.includes("overdue")
  ) {
    const pendingTasks = tasks.filter(
      (task) =>
        !["approved", "closed"].includes(task.status)
    );

    const urgentTasks = pendingTasks.filter(
      (task) =>
        ["urgent", "high"].includes(task.priority)
    );

    const overdueTasks = pendingTasks.filter(
      (task) =>
        task.due_at &&
        new Date(task.due_at).getTime() < Date.now()
    );

    if (question.includes("overdue")) {
      if (!overdueTasks.length) {
        return "There are no overdue tasks in the available records.";
      }

      return "Overdue tasks:\n" +
        overdueTasks.map(
          (task) =>
            `• ${task.title} | Due: ${formatDate(task.due_at)} | Status: ${task.status}`
        ).join("\n");
    }

    if (
      question.includes("recommend") ||
      question.includes("attention") ||
      question.includes("priority") ||
      question.includes("urgent")
    ) {
      if (!urgentTasks.length && !overdueTasks.length) {
        return "No urgent or overdue tasks were identified in the available records.";
      }

      return [
        "Task recommendations:",
        ...urgentTasks.map(
          (task) => `• Give priority to: ${task.title} (${task.priority})`
        ),
        ...overdueTasks.map(
          (task) => `• Review overdue task: ${task.title}`
        )
      ].join("\n");
    }

    return [
      "Temple task summary:",
      summarizeTasks(tasks),
      "",
      `Pending tasks: ${pendingTasks.length}`,
      `High/urgent priority tasks: ${urgentTasks.length}`,
      `Overdue tasks: ${overdueTasks.length}`
    ].join("\n");
  }

  // Attendance-related questions
  if (
    question.includes("attendance") ||
    question.includes("absent") ||
    question.includes("present") ||
    question.includes("staff")
  ) {
    return [
      "Temple attendance summary:",
      summarizeAttendance(attendance)
    ].join("\n");
  }

  // Booking-related questions
  if (
    question.includes("booking") ||
    question.includes("hall") ||
    question.includes("room") ||
    question.includes("reservation")
  ) {
    return [
      "Temple booking summary:",
      summarizeBookings(bookings)
    ].join("\n");
  }

  // General operational questions
  if (
    question.includes("overview") ||
    question.includes("summary") ||
    question.includes("temple")
  ) {
    return [
      "Welcome to the Temple AI Operations Assistant!",
      "",
      "TASKS",
      summarizeTasks(tasks),
      "",
      "ATTENDANCE",
      summarizeAttendance(attendance),
      "",
      "BOOKINGS",
      summarizeBookings(bookings)
    ].join("\n");
  }

  if (
    question.includes("hello") ||
    question.includes("hi") ||
    question.includes("good morning")
  ) {
    return "Namaste! Welcome to the Temple Operations Assistant. I can help you with tasks, attendance, bookings, daily summaries and task recommendations.";
  }

  return [
    "Namaste! I am the Temple Operations Assistant.",
    "",
    "I can help you with:",
    "• Task status and pending work",
    "• Overdue and urgent tasks",
    "• Staff attendance",
    "• Hall, room and event bookings",
    "• Temple operations overview",
    "",
    "Please ask me a question about one of these topics."
  ].join("\n");
};
