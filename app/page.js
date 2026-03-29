import Link from "next/link";
import { FaBell, FaCalendarAlt, FaCheckCircle } from "react-icons/fa";
import Button from "@/components/ui/Button";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ClientRedirect from "@/components/auth/ClientRedirect";

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="text-center">
      <ClientRedirect />
      {/* Hero Section */}
      <div className="py-20">
        <FaBell className="text-primary text-6xl mx-auto mb-6" />
        <h1 className="text-5xl font-bold text-text-primary mb-4">
          Never Forget Anything Again
        </h1>
        <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
          Stay organized with our intelligent reminder application. Create, manage, and track all your important tasks in one place.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/reminders/new">
            <Button variant="primary" className="text-lg px-8 py-3">
              Create Your First Reminder
            </Button>
          </Link>
          <Link href="/reminders">
            <Button variant="outline" className="text-lg px-8 py-3">
              View All Reminders
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-surface rounded-lg shadow-md">
        <h2 className="text-3xl font-bold text-text-primary mb-12">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-6">
          <div className="text-center">
            <FaCalendarAlt className="text-primary text-4xl mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-text-primary mb-2">
              One-time & Recurring
            </h3>
            <p className="text-text-secondary">
              Set reminders for specific dates or create recurring reminders that repeat daily, weekly, monthly, or yearly.
            </p>
          </div>

          <div className="text-center">
            <FaCheckCircle className="text-success text-4xl mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-text-primary mb-2">
              Easy Organization
            </h3>
            <p className="text-text-secondary">
              Organize your reminders with flexible tags like work, personal, health, or create your own for better organization.
            </p>
          </div>

          <div className="text-center">
            <FaBell className="text-accent text-4xl mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-text-primary mb-2">
              Smart Notifications
            </h3>
            <p className="text-text-secondary">
              Get timely notifications for your reminders so you never miss an important task or event.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16">
        <h2 className="text-3xl font-bold text-text-primary mb-4">
          Ready to Get Organized?
        </h2>
        <p className="text-lg text-text-secondary mb-8">
          Start managing your reminders effectively today.
        </p>
        <Link href="/reminders/new">
          <Button variant="primary" className="text-lg px-8 py-3">
            Get Started Now
          </Button>
        </Link>
      </div>
    </div>
  );
}
