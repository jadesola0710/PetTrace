import Image from "next/image";
import Link from "next/link";
import { FaPaw } from "react-icons/fa";

export default function HeroBanner() {
  return (
    <section className="relative w-full bg-gradient-to-r from-yellow-50 to-purple-50 rounded-3xl p-8 md:p-12 overflow-hidden border border-yellow-100 shadow-sm">
      {/* Decorative elements */}
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-yellow-100 opacity-30"></div>
      <div className="absolute -left-20 bottom-0 w-64 h-64 rounded-full bg-purple-100 opacity-20"></div>

      {/* Content container */}
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Text Section */}
        <div className="text-center md:text-left md:max-w-xl">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight">
            Reuniting Lost Pets{" "}
            <span className="text-yellow-600">With Their Families</span>
          </h1>

          <p className="text-lg text-gray-600 mt-4 mb-6">
            A decentralized platform powered by blockchain technology to help
            bring your furry friends home safely.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <Link
              href="/report_page"
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <FaPaw /> Report Lost Pet
            </Link>
            <Link
              href="/view_reports"
              className="border border-yellow-600 text-yellow-600 hover:bg-yellow-50 px-6 py-3 rounded-xl font-medium transition-colors shadow-sm flex items-center justify-center"
            >
              View Lost Pets
            </Link>
          </div>

          <div className="mt-6 flex items-center justify-center md:justify-start gap-2 text-sm text-gray-500">
            <div className="flex items-center">
              <span className="h-2 w-2 rounded-full bg-green-400 mr-2"></span>
              Powered by Base
            </div>
          </div>
        </div>

        {/* Dog Image */}
        <div className="relative w-64 h-64 md:w-80 md:h-80">
          <Image
            src="/pet-image.png"
            alt="Happy dog illustration"
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>
    </section>
  );
}
