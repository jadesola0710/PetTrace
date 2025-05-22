import Image from "next/image";
import Link from "next/link";

interface Pet {
  id: number;
  name: string;
  breed: string;
  gender: string;
  sizeCm: number;
  ageMonths: number;
  dateTimeLost: string;
  description: string;
  imageUrl: string;
  lastSeenLocation: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  ethBounty: number;
  cusdBounty: number;
  isFound: boolean;
}

export default function PetCard({ pet }: { pet: Pet }) {
  // Format the date for display
  const formattedDate = new Date(pet.dateTimeLost).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="relative w-full rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
      {/* Top bar with location and heart icon */}
      <div className="absolute top-2 left-2 bg-white/80 backdrop-blur-md text-xs px-2 py-1 rounded-full flex items-center space-x-1 z-10">
        <svg
          className="w-4 h-4 text-gray-600"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C8.13 2 5 5.13 5 9c0 7 7 13 7 13s7-6 7-13c0-3.87-3.13-7-7-7z" />
        </svg>
        <span>{pet.lastSeenLocation}</span>
      </div>

      <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-md p-1 rounded-full z-10">
        <span>♥</span>
      </div>

      {/* Pet Image */}
      <div className="w-full h-60 relative">
        <Image
          src={pet.imageUrl || "/default-pet.png"}
          alt={pet.name}
          fill
          className="object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/default-pet.png";
          }}
        />
      </div>

      {/* Bottom Text */}
      <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/60 to-transparent text-white p-4">
        <div className="text-xs mt-2">
          <h3 className="font-bold text-lg">{pet.name}</h3>
          <p>Lost on: {formattedDate}</p>
        </div>
        <div className="flex justify-between items-center mt-2">
          <button className="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30">
            <Link href={`/view_pet_details/${pet.id}`}>View Details</Link>
          </button>
        </div>
      </div>
    </div>
  );
}
