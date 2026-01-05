export default function Footer() {
  return (
    <footer className="bg-surface border-t border-border text-text-primary mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p className="text-text-muted">
            © {new Date().getFullYear()} ReminderApp. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
