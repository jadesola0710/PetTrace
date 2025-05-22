import Image from "next/image";
import Link from "next/link";
import { FaShieldAlt, FaLock, FaUserShield } from "react-icons/fa";

export default function HelpSearchSection() {
  return (
    <section className="bg-gradient-to-br from-white to-yellow-50 rounded-2xl border border-gray-100 shadow-sm mt-8 p-8">
      <div className="flex flex-col md:flex-row items-center gap-8">
        {/* Illustration */}
        <div className="flex-shrink-0 relative w-48 h-48 md:w-56 md:h-56">
          <Image
            src="/pet.png"
            alt="Protected pet illustration"
            fill
            className="object-contain"
          />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Why PetTrace Stands Out
          </h2>

          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-4">
              <div className="mt-1 p-2 bg-yellow-100 rounded-full text-yellow-600">
                <FaShieldAlt size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">
                  Decentralized Security
                </h3>
                <p className="text-gray-600 text-sm md:text-base">
                  No central database to hack - only you control your pet's
                  sensitive data
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="mt-1 p-2 bg-yellow-100 rounded-full text-yellow-600">
                <FaLock size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">
                  Transparent Process
                </h3>
                <p className="text-gray-600 text-sm md:text-base">
                  Every interaction is recorded on-chain for complete
                  transparency
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="mt-1 p-2 bg-yellow-100 rounded-full text-yellow-600">
                <FaUserShield size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">
                  Community Powered
                </h3>
                <p className="text-gray-600 text-sm md:text-base">
                  Network of pet lovers working together to reunite lost animals
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/report_page"
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-3 rounded-xl font-medium text-center transition-colors shadow-sm"
            >
              Report Lost Pet
            </Link>
            <Link
              href="/how-it-works"
              className="border border-yellow-600 text-yellow-600 hover:bg-yellow-50 px-5 py-3 rounded-xl font-medium text-center transition-colors shadow-sm"
            >
              Learn How It Works
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
