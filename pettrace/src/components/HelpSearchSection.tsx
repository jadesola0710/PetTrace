import Image from "next/image";
import Link from "next/link";

export default function HelpSearchSection() {
  return (
    <section className="bg-white rounded-2xl shadow-md mt-6 p-6 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
      {/* Dog with umbrella image */}
      <div className="flex-shrink-0">
        <Image
          src="/pet.png" // Place this image in /public folder
          alt="Dog with umbrella"
          width={150}
          height={150}
          className="object-contain"
        />
      </div>

      {/* Text + CTA */}
      <div className="text-center md:text-left flex-1">
        <h2 className="text-xl md:text-2xl font-semibold text-gray-800">
          Why Choose PetTrace? (Trust & Social Proof)
        </h2>
        <p className="text-gray-600 mt-2 text-sm md:text-base">
          No central database to hack; only you control your pet’s data.
        </p>

        <Link href="/report_page" passHref>
          <button className="mt-4 inline-flex items-center bg-yellow-500 text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-yellow-600 transition">
            Report a Lost Pet <span className="ml-2 text-lg">+</span>
          </button>
        </Link>
      </div>
    </section>
  );
}
