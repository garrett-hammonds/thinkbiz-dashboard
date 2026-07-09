import { Mail, Phone } from "lucide-react";

export default function SupportPage() {
  return (

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="text-center">
          <h1 className="text-4xl font-black text-foreground mb-4">How can we help?</h1>
          <p className="text-lg text-gray-500 mb-12">
            Reach out to the ThinkBiz support team for assistance with your dashboard or membership.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Email Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8 text-center transition-all duration-200 hover:shadow-card-hover hover:-translate-y-[2px]">
            <div className="flex justify-center mb-4">
              <Mail className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold leading-snug text-foreground mb-3">Email Support</h3>
            <p className="text-gray-900 mb-6">
              Our team typically responds to email inquiries within 24 hours during normal business days.
            </p>
            <a
              href="mailto:team@thinkbiz.solutions"
              className="border-2 border-primary text-primary hover:bg-primary hover:text-white px-6 py-3 rounded-lg font-semibold mt-6 inline-block"
            >
              Email Us
            </a>
          </div>

          {/* Phone Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-card p-8 text-center transition-all duration-200 hover:shadow-card-hover hover:-translate-y-[2px]">
            <div className="flex justify-center mb-4">
              <Phone className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold leading-snug text-foreground mb-3">Call Us</h3>
            <p className="text-gray-900 mb-6">
              Available Monday through Friday, 9:00 AM to 5:00 PM CST for assistance.
            </p>
            <a
              href="tel:+14053679874"
              className="border-2 border-primary text-primary hover:bg-primary hover:text-white px-6 py-3 rounded-lg font-semibold mt-6 inline-block"
            >
              +1 (405) 367-9874
            </a>
          </div>
        </div>
      </main>
  );
}
