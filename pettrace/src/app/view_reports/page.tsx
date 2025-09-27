"use client";
import PetCard from "@/components/PetCard";
import { useEffect, useState } from "react";
import PetTraceABI from "../../../abi.json";
import { useAccount, useReadContract } from "wagmi";

interface Pet {
  id: number;
  owner: string;
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
  ownerConfirmed: boolean;
  finderConfirmed: boolean;
  finder: string;
}

export default function ReportPage() {
  const CONTRACT_ADDRESS = "0xC426c84e5b0eaa7Ed207854e99F5559981aa07F0";
  const [lostPets, setLostPets] = useState<Pet[]>([]);

  const { data, error, isLoading, isError, isSuccess } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PetTraceABI.abi,
    functionName: "getAllLostPets",
    query: {
      staleTime: 60_000,
    },
  });

  useEffect(() => {
    if (isSuccess && data) {
      const [ids, petData] = data as [bigint[], any[]];
      const formattedPets = petData.map(
        (pet, idx): Pet => ({
          id: Number(ids[idx]),
          owner: String(pet.owner),
          name: String(pet.name),
          breed: String(pet.breed),
          gender: String(pet.gender),
          sizeCm: Number(pet.sizeCm),
          ageMonths: Number(pet.ageMonths),
          dateTimeLost: String(pet.dateTimeLost),
          description: String(pet.description),
          imageUrl: String(pet.imageUrl),
          lastSeenLocation: String(pet.lastSeenLocation),
          contactName: String(pet.contactName),
          contactPhone: String(pet.contactPhone),
          contactEmail: String(pet.contactEmail),
          ethBounty: Number(pet.ethBounty),
          cusdBounty: Number(pet.cusdBounty),
          isFound: Boolean(pet.isFound),
          ownerConfirmed: Boolean(pet.ownerConfirmed),
          finderConfirmed: Boolean(pet.finderConfirmed),
          finder: String(pet.finder || ""),
        })
      );
      setLostPets(formattedPets);
    }
  }, [isSuccess, data]);

  // console.log(lostPets);
  if (isLoading)
    return <div className="text-center py-8">Loading lost pets...</div>;
  if (error)
    return (
      <div className="text-center py-8 text-red-500">
        Error: {error.message}
      </div>
    );

  return (
    <main className="container mx-auto py-8">
      {/* Lost Pets Section */}
      <section className="max-w-7xl mx-auto mt-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Recently Lost Pets
        </h2>

        {lostPets.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <h3 className="text-lg font-medium">No lost pets found</h3>
            <p className="text-gray-500 mt-2">
              Check back later or report a lost pet
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lostPets.map((pet, index) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
