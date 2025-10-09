export default function Footer() {
  return (
    <footer className="bg-gray-800 dark:bg-gray-950 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p className="text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} ReminderApp. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
