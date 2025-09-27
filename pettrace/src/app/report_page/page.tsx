"use client";
import ReportPetForm from "@/components/ReportPetForm";
import { useLoadScript } from "@react-google-maps/api";

// 👇 define libraries outside so they’re not re-created on each render
const libraries: "places"[] = ["places"];

export default function ReportPage() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY as string,
    libraries,
  });

  if (!isLoaded) return <p>Loading maps...</p>;

  return (
    <main className="container mx-auto py-8">
      <ReportPetForm />
    </main>
  );
}
