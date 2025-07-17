"use client";
import {
  FaHeart,
  FaChevronLeft,
  FaChevronRight,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaUser,
} from "react-icons/fa";
import { useParams } from "next/navigation";
import {
  useReadContract,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
} from "wagmi";
import PetTraceABI from "../../../../abi.json";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

// Updated to Celo contract address
const CONTRACT_ADDRESS = "0x850388b814B69ec4Da3cB3ac7637768adf9A0B00";

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
  celoBounty: number;
  cUSDBounty: number;
  isFound: boolean;
  ownerConfirmed: boolean;
  finderConfirmed: boolean;
  finder: string;
}

export default function PetDetails() {
  const { id } = useParams<{ id: string }>();
  const petId = id ? BigInt(id) : BigInt(0);
  const { writeContract } = useWriteContract();
  const [isMarkingFound, setIsMarkingFound] = useState(false);
  const [isConfirmingFound, setIsConfirmingFound] = useState(false);
  const [isClaimingBounty, setIsClaimingBounty] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();
  const [activeImage, setActiveImage] = useState(0);

  // Add transaction waiting
  const {
    data: receipt,
    isError: isTxError,
    isLoading: isTxLoading,
  } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}`,
  });

  useEffect(() => {
    if (receipt && !isTxLoading) {
      toast.success("Transaction confirmed on blockchain!");
    }
    if (isTxError) {
      toast.error("Transaction failed on chain");
    }
  }, [receipt, isTxLoading, isTxError]);

  const {
    data: petData,
    isLoading,
    isError,
    refetch: refetchPetData,
  } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PetTraceABI.abi,
    functionName: "getPetDetails",
    args: [petId],
  });

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 w-64 bg-gray-200 rounded mx-auto mb-4"></div>
          <div className="h-4 w-48 bg-gray-200 rounded mx-auto"></div>
        </div>
      </div>
    );

  if (isError)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-6 bg-red-50 rounded-xl max-w-md">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            Error loading pet details
          </h2>
          <p className="text-gray-600 mb-4">
            We couldn't load the pet information. Please try again.
          </p>
          <Link
            href="/view_reports"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <FiArrowLeft className="mr-2" /> Back to all pets
          </Link>
        </div>
      </div>
    );

  const petArray = petData as any[];
  const formattedPet: Pet = {
    id: Number(petId),
    owner: petArray[1],
    name: petArray[2],
    breed: petArray[3],
    gender: petArray[4],
    sizeCm: Number(petArray[5]),
    ageMonths: Number(petArray[6]),
    dateTimeLost: petArray[7],
    description: petArray[8],
    imageUrl: petArray[9],
    lastSeenLocation: petArray[10],
    contactName: petArray[11],
    contactPhone: petArray[12],
    contactEmail: petArray[13],
    celoBounty: Number(petArray[14]),
    cUSDBounty: Number(petArray[15]),
    isFound: petArray[16],
    ownerConfirmed: petArray[17],
    finderConfirmed: petArray[18],
    finder: petArray[19] || "",
  };

  const getImageUrl = () => {
    if (!formattedPet.imageUrl) return "/default-formattedPet.jpg";
    return formattedPet.imageUrl.startsWith("http")
      ? formattedPet.imageUrl
      : `https://ipfs.io/ipfs/${formattedPet.imageUrl}`;
  };

  const thumbnails = [
    getImageUrl(),
    "/images/pet2.jpg",
    "/images/pet3.jpg",
    "/images/pet4.jpg",
  ];

  const formatBounty = (amount: number, isCUSD: boolean = false) => {
    if (isCUSD) {
      return (amount / 1e18).toFixed(2) + " cUSD"; // cUSD uses 18 decimals on Celo
    }
    return (amount / 1e18).toFixed(4) + " CELO"; // CELO also uses 18 decimals
  };

  const handleMarkAsFound = () => {
    console.log("Attempting markAsFound with:", {
      petId,
      caller: address,
      owner: formattedPet.owner,
      isFound: formattedPet.isFound,
      finder: formattedPet.finder,
    });

    if (!isConnected) {
      const errMsg = "Please connect your wallet first";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (formattedPet.owner.toLowerCase() === address?.toLowerCase()) {
      const errMsg = "You can't mark your own pet as found";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (formattedPet.isFound) {
      const errMsg = "This pet has already been found";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    setIsMarkingFound(true);
    setError(null);
    setTxHash(null);

    writeContract(
      {
        address: CONTRACT_ADDRESS,
        abi: PetTraceABI.abi,
        functionName: "markAsFound",
        args: [petId],
      },
      {
        onSuccess: (hash) => {
          console.log("Transaction hash:", hash);
          setTxHash(hash);
          toast.success("Transaction submitted! Waiting for confirmation...");
        },
        onError: (error) => {
          console.error("Transaction error:", error);
          const errMsg = error.message || "Transaction failed";
          setError(errMsg);
          toast.error(errMsg);
        },
        onSettled: () => {
          setIsMarkingFound(false);
          refetchPetData();
        },
      }
    );
  };

  const handleConfirmFoundByOwner = () => {
    console.log("Attempting confirmFoundByOwner with:", {
      petId,
      caller: address,
      owner: formattedPet.owner,
      finder: formattedPet.finder,
      ownerConfirmed: formattedPet.ownerConfirmed,
    });

    if (!isConnected) {
      const errMsg = "Please connect your wallet first";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (formattedPet.owner.toLowerCase() !== address?.toLowerCase()) {
      const errMsg = "Only the pet owner can confirm";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (!formattedPet.finder) {
      const errMsg = "No finder has been assigned yet";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    setIsConfirmingFound(true);
    setError(null);
    setTxHash(null);

    writeContract(
      {
        address: CONTRACT_ADDRESS,
        abi: PetTraceABI.abi,
        functionName: "confirmFoundByOwner",
        args: [petId],
      },
      {
        onSuccess: (hash) => {
          console.log("Confirmation tx hash:", hash);
          setTxHash(hash);
          toast.success("Confirmation submitted! Waiting...");
        },
        onError: (error) => {
          console.error("Confirmation error:", error);
          const errMsg = error.message || "Confirmation failed";
          setError(errMsg);
          toast.error(errMsg);
        },
        onSettled: () => {
          setIsConfirmingFound(false);
          refetchPetData();
        },
      }
    );
  };

  const handleClaimBounty = () => {
    console.log("Attempting to claim bounty:", {
      petId,
      caller: address,
      finder: formattedPet.finder,
      celoBounty: formattedPet.celoBounty,
      cUSDBounty: formattedPet.cUSDBounty,
    });

    if (!isConnected) {
      const errMsg = "Please connect your wallet first";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (formattedPet.finder.toLowerCase() !== address?.toLowerCase()) {
      const errMsg = "Only the finder can claim the bounty";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (!formattedPet.isFound) {
      const errMsg = "Pet must be confirmed as found by both parties";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (formattedPet.celoBounty <= 0 && formattedPet.cUSDBounty <= 0) {
      const errMsg = "No bounty available to claim";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    setIsClaimingBounty(true);
    setError(null);
    setTxHash(null);
    toast.loading("Processing bounty claim...");

    writeContract(
      {
        address: CONTRACT_ADDRESS,
        abi: PetTraceABI.abi,
        functionName: "claimBounty",
        args: [petId],
      },
      {
        onSuccess: (hash) => {
          console.log("Bounty claim tx hash:", hash);
          setTxHash(hash);
          toast.success("Bounty claim submitted! Waiting for confirmation...");
        },
        onError: (error) => {
          console.error("Bounty claim error:", error);
          const errMsg = error.message || "Failed to claim bounty";
          setError(errMsg);
          toast.error(errMsg);
        },
        onSettled: () => {
          setIsClaimingBounty(false);
          refetchPetData();
          toast.dismiss();
        },
      }
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          href="/view_reports"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
        >
          <FiArrowLeft className="mr-2" /> Back to all pets
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Image Gallery */}
        <div className="lg:w-1/2">
          <div className="relative w-full h-96 lg:h-[500px] rounded-2xl overflow-hidden shadow-lg">
            <img
              src={thumbnails[activeImage] || "/images/pet-placeholder.jpg"}
              alt={formattedPet.name}
              className="w-full h-full object-cover transition-opacity duration-300"
            />

            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {thumbnails.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveImage(index)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    activeImage === index
                      ? "bg-indigo-600 w-6"
                      : "bg-white bg-opacity-50"
                  }`}
                  aria-label={`View image ${index + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-4 gap-3">
            {thumbnails.map((src, index) => (
              <button
                key={index}
                onClick={() => setActiveImage(index)}
                className={`h-24 rounded-lg overflow-hidden border-2 transition-all ${
                  activeImage === index
                    ? "border-indigo-500"
                    : "border-transparent"
                }`}
              >
                <img
                  src={src}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>

          {/* Bounty Card */}
          <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-xl border border-indigo-100 shadow-sm">
            <h3 className="text-lg font-semibold text-indigo-700 mb-3 flex items-center">
              <span className="bg-indigo-100 p-2 rounded-full mr-3">
                <FaHeart className="text-indigo-600" />
              </span>
              Reward for Finding
            </h3>
            <div className="flex justify-between items-center">
              {formattedPet.celoBounty > 0 && (
                <span className="text-xl font-bold bg-white px-4 py-2 rounded-lg shadow-sm">
                  {formatBounty(formattedPet.celoBounty)}
                </span>
              )}
              {formattedPet.cUSDBounty > 0 && (
                <span className="text-xl font-bold bg-white px-4 py-2 rounded-lg shadow-sm">
                  {formatBounty(formattedPet.cUSDBounty, true)}
                </span>
              )}
            </div>
            {formattedPet.isFound && (
              <div className="mt-3 text-sm text-green-600 font-medium">
                This pet has been found!
              </div>
            )}
          </div>
        </div>

        {/* Right: Pet Details */}
        <div className="lg:w-1/2">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {formattedPet.name}
                </h1>
                <p className="text-gray-500">
                  {formattedPet.breed} • Lost on{" "}
                  {new Date(formattedPet.dateTimeLost).toLocaleDateString()}
                </p>
              </div>
              <button className="text-pink-400 hover:text-pink-600 transition-colors">
                <FaHeart className="text-2xl" />
              </button>
            </div>

            {/* Pet Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-indigo-50 p-3 rounded-lg text-center">
                <div className="text-sm text-indigo-600 mb-1">Gender</div>
                <div className="font-semibold">{formattedPet.gender}</div>
              </div>
              <div className="bg-indigo-50 p-3 rounded-lg text-center">
                <div className="text-sm text-indigo-600 mb-1">Size</div>
                <div className="font-semibold">{formattedPet.sizeCm} cm</div>
              </div>
              <div className="bg-indigo-50 p-3 rounded-lg text-center">
                <div className="text-sm text-indigo-600 mb-1">Age</div>
                <div className="font-semibold">
                  {formattedPet.ageMonths} months
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                About {formattedPet.name}
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {formattedPet.description}
              </p>
            </div>

            {/* Location */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                <FaMapMarkerAlt className="text-red-500 mr-2" />
                Last Seen Location
              </h3>
              <p className="text-gray-700">{formattedPet.lastSeenLocation}</p>
              <div className="mt-3 rounded-xl overflow-hidden h-48 border border-gray-200">
                <iframe
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    formattedPet.lastSeenLocation
                  )}&output=embed`}
                  className="w-full h-full border-0"
                  loading="lazy"
                ></iframe>
              </div>
            </div>

            {/* Contact Info */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Owner Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center">
                  <FaUser className="text-gray-500 mr-3" />
                  <span className="text-gray-700">
                    {formattedPet.contactName}
                  </span>
                </div>
                <div className="flex items-center">
                  <FaPhone className="text-gray-500 mr-3" />
                  <a
                    href={`tel:${formattedPet.contactPhone}`}
                    className="text-gray-700 hover:text-indigo-600"
                  >
                    {formattedPet.contactPhone}
                  </a>
                </div>
                {formattedPet.contactEmail && (
                  <div className="flex items-center">
                    <FaEnvelope className="text-gray-500 mr-3" />
                    <a
                      href={`mailto:${formattedPet.contactEmail}`}
                      className="text-gray-700 hover:text-indigo-600"
                    >
                      {formattedPet.contactEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!formattedPet.isFound && (
                <>
                  {formattedPet.owner.toLowerCase() !==
                    address?.toLowerCase() && (
                    <button
                      onClick={handleMarkAsFound}
                      disabled={isMarkingFound}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-6 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isMarkingFound ? (
                        <span className="flex items-center">
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        "I Found This Pet"
                      )}
                    </button>
                  )}

                  {formattedPet.owner.toLowerCase() ===
                    address?.toLowerCase() &&
                    formattedPet.finder &&
                    !formattedPet.ownerConfirmed && (
                      <button
                        onClick={handleConfirmFoundByOwner}
                        disabled={isConfirmingFound}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isConfirmingFound ? "Processing..." : "Confirm Found"}
                      </button>
                    )}
                </>
              )}

              {formattedPet.isFound &&
                formattedPet.finder.toLowerCase() === address?.toLowerCase() &&
                (formattedPet.celoBounty > 0 ||
                  formattedPet.cUSDBounty > 0) && (
                  <button
                    onClick={handleClaimBounty}
                    disabled={isClaimingBounty}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-6 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isClaimingBounty ? "Claiming..." : "Claim Reward"}
                  </button>
                )}

              <Link
                href="/view_reports"
                className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 py-3 px-6 rounded-xl font-medium transition-colors shadow-sm text-center"
              >
                View All Pets
              </Link>
            </div>

            {/* Status Messages */}
            {txHash && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg border border-green-100">
                <p className="font-medium">Transaction submitted!</p>
                <p className="text-sm opacity-80 break-all">{txHash}</p>
              </div>
            )}
            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-100">
                <p className="font-medium">Error</p>
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
