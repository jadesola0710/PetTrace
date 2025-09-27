"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWalletClient,
} from "wagmi";
import { encodeFunctionData, parseEther } from "viem";
import { celo } from "wagmi/chains";
import { toast } from "react-hot-toast";
import PetTraceABI from "../../abi.json";
import { erc20Abi } from "viem";
import { getReferralTag, submitReferral } from "@divvi/referral-sdk";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";
import {
  useLoadScript,
  GoogleMap,
  MarkerF,
  CircleF,
} from "@react-google-maps/api";
import {
  SelfQRcodeWrapper,
  SelfAppBuilder,
  type SelfApp,
} from "@selfxyz/qrcode";
import { getUniversalLink } from "@selfxyz/core";

// Contract addresses
const CONTRACT_ADDRESS = "0xC426c84e5b0eaa7Ed207854e99F5559981aa07F0";
const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const GDOLLAR_ADDRESS = "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A";

interface PetFormData {
  name: string;
  breed: string;
  gender: string;
  sizeCm: string;
  ageMonths: string;
  dateTimeLost: string;
  description: string;
  lastSeenLocation: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  ethBounty: string;
  cusdBounty: string;
  gDollarBounty: string;
  useCUSD: boolean;
  useGDOLLAR: boolean;
}

export default function ReportPetForm() {
  const router = useRouter();
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();

  // State management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [approvalToastId, setApprovalToastId] = useState<string | null>(null);
  const [reportToastId, setReportToastId] = useState<string | null>(null);
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | undefined>();
  const [reportHash, setReportHash] = useState<`0x${string}` | undefined>();
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [universalLink, setUniversalLink] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const [formData, setFormData] = useState<PetFormData>({
    name: "",
    breed: "",
    gender: "",
    sizeCm: "",
    ageMonths: "",
    dateTimeLost: "",
    description: "",
    lastSeenLocation: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    ethBounty: "0.001",
    cusdBounty: "1",
    gDollarBounty: "10", // Default G$ bounty
    useCUSD: false,
    useGDOLLAR: false,
  });

  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    debounce: 300,
    cache: 86400,
  });

  // Transaction hooks
  const { isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalHash,
  });

  const { isSuccess: isReportConfirmed } = useWaitForTransactionReceipt({
    hash: reportHash,
  });

  const DIVVI_CONFIG = {
    user: address as `0x${string}`,
    consumer: "0x124D8fad33E0b9fe9F3e1E90D0fC0055aBE8cA8d" as `0x${string}`,
  };

  // Check network
  useEffect(() => {
    setIsCorrectNetwork(chainId === celo.id);
  }, [chainId]);

  // Handle form changes
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle currency selection
  const handleSelectCurrency = (currency: "CELO" | "CUSD" | "G$") => {
    setFormData((prev) => ({
      ...prev,
      useCUSD: currency === "CUSD",
      useGDOLLAR: currency === "G$",
    }));
  };

  // Form validation
  const validateForm = () => {
    if (!address) {
      toast.error("Please connect your wallet");
      return false;
    }

    if (!isCorrectNetwork) {
      toast.error("Please switch to Celo network");
      return false;
    }

    // Required fields check
    const requiredFields = [
      "name",
      "breed",
      "gender",
      "sizeCm",
      "ageMonths",
      "dateTimeLost",
      "description",
      "lastSeenLocation",
      "contactName",
      "contactPhone",
    ];

    for (const field of requiredFields) {
      if (!formData[field as keyof PetFormData]) {
        toast.error(
          `Please fill in ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`
        );
        return false;
      }
    }

    // Bounty validation
    let bountyAmount = "";
    if (formData.useCUSD) {
      bountyAmount = formData.cusdBounty;
    } else if (formData.useGDOLLAR) {
      bountyAmount = formData.gDollarBounty;
    } else {
      bountyAmount = formData.ethBounty;
    }

    if (isNaN(parseFloat(bountyAmount))) {
      toast.error("Please enter a valid bounty amount");
      return false;
    }

    if (parseFloat(bountyAmount) <= 0) {
      toast.error("Bounty amount must be greater than 0");
      return false;
    }

    if (!file) {
      toast.error("Please upload a pet image");
      return false;
    }

    return true;
  };

  // Token approval functions
  const approveToken = async (
    tokenAddress: string,
    amount: string,
    tokenName: string
  ) => {
    if (!walletClient || !address) {
      toast.error("Wallet not connected");
      return;
    }

    try {
      const amountInWei = parseEther(amount);
      const toastId = toast.loading(`Approving ${tokenName} spending...`);
      setApprovalToastId(toastId);

      const approvalData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, amountInWei],
      });

      const hash = await walletClient.sendTransaction({
        account: address,
        to: tokenAddress as `0x${string}`,
        data: approvalData,
      });

      setApprovalHash(hash as `0x${string}`);
      return hash;
    } catch (error) {
      toast.error(`Failed to approve ${tokenName} spending`);
      setApprovalToastId(null);
      throw error;
    }
  };

  // File handling
  const handleFileChange = (
    fileOrEvent: File | React.ChangeEvent<HTMLInputElement>
  ) => {
    setError(null);
    let selectedFile: File | null = null;

    if (fileOrEvent instanceof File) {
      selectedFile = fileOrEvent;
    } else if (fileOrEvent.target.files?.[0]) {
      selectedFile = fileOrEvent.target.files[0];
    }

    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selectedFile);
  };

  // IPFS upload
  const uploadToIPFS = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append(
      "pinataMetadata",
      JSON.stringify({
        name: `pettrace-image-${Date.now()}`,
      })
    );

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`,
        },
      }
    );

    if (response.status !== 200) {
      throw new Error("Failed to upload image");
    }

    return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
  };

  // Drag and drop handlers
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Main pet reporting function
  const reportPet = async () => {
    if (!walletClient || !address) {
      toast.error("Wallet not connected");
      return;
    }

    try {
      const toastId = toast.loading("Reporting lost pet...");
      setReportToastId(toastId);

      // Upload image
      const imageUrl = await uploadToIPFS(file!);
      const ipfsHash = imageUrl.split("/").pop() || "";
      if (ipfsHash.length > 200) throw new Error("Image URL too long");

      // Prepare bounty data
      let bountyAmount = "0";
      let bountyInWei = BigInt(0);
      let currency = "CELO";

      if (formData.useCUSD) {
        bountyAmount = formData.cusdBounty;
        bountyInWei = parseEther(bountyAmount);
        currency = "cUSD";
      } else if (formData.useGDOLLAR) {
        bountyAmount = formData.gDollarBounty;
        bountyInWei = parseEther(bountyAmount);
        currency = "G$";
      } else {
        bountyAmount = formData.ethBounty;
        bountyInWei = parseEther(bountyAmount);
      }

      // Generate referral tag
      const divviSuffix = getReferralTag(DIVVI_CONFIG);

      // Encode contract call
      const encodedFunction = encodeFunctionData({
        abi: PetTraceABI.abi,
        functionName: "postLostPet",
        args: [
          formData.name,
          formData.breed,
          formData.gender,
          Number(formData.sizeCm),
          Number(formData.ageMonths),
          formData.dateTimeLost,
          formData.description,
          ipfsHash,
          formData.lastSeenLocation,
          formData.contactName,
          formData.contactPhone,
          formData.contactEmail,
          formData.useCUSD ? bountyInWei.toString() : "0",
          formData.useGDOLLAR ? bountyInWei.toString() : "0",
        ],
      });

      const dataWithDivvi = (encodedFunction +
        (divviSuffix.startsWith("0x")
          ? divviSuffix.slice(2)
          : divviSuffix)) as `0x${string}`;

      // Send transaction
      const hash = await walletClient.sendTransaction({
        account: address,
        to: CONTRACT_ADDRESS,
        data: dataWithDivvi,
        value:
          formData.useCUSD || formData.useGDOLLAR ? BigInt(0) : bountyInWei,
      });

      setReportHash(hash as `0x${string}`);

      // Submit referral
      await submitReferral({
        txHash: hash,
        chainId: chainId || 42220,
      });

      return hash;
    } catch (error) {
      toast.error("Failed to report pet");
      setReportToastId(null);
      throw error;
    }
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (formData.useCUSD) {
        await approveToken(CUSD_ADDRESS, formData.cusdBounty, "cUSD");
        return;
      }

      if (formData.useGDOLLAR) {
        await approveToken(GDOLLAR_ADDRESS, formData.gDollarBounty, "G$");
        return;
      }

      await reportPet();
    } catch (error) {
      toast.error("Failed to submit pet report");
      setIsSubmitting(false);
    }
  };

  // Handle approval confirmation
  useEffect(() => {
    if (isApprovalConfirmed && (formData.useCUSD || formData.useGDOLLAR)) {
      if (approvalToastId) {
        toast.dismiss(approvalToastId);
        setApprovalToastId(null);
      }

      const toastId = toast.loading("Reporting lost pet after approval...");
      setReportToastId(toastId);
      reportPet();
    }
  }, [isApprovalConfirmed, formData.useCUSD, formData.useGDOLLAR]);

  // Handle successful report
  useEffect(() => {
    if (isReportConfirmed) {
      if (reportToastId) {
        toast.dismiss(reportToastId);
        setReportToastId(null);
      }

      toast.success("Pet reported successfully!");

      // Reset form
      setFormData({
        name: "",
        breed: "",
        gender: "",
        sizeCm: "",
        ageMonths: "",
        dateTimeLost: "",
        description: "",
        lastSeenLocation: "",
        contactName: "",
        contactPhone: "",
        contactEmail: "",
        ethBounty: "0.001",
        cusdBounty: "1",
        gDollarBounty: "10",
        useCUSD: false,
        useGDOLLAR: false,
      });

      setTimeout(() => router.push("/view_reports"), 1500);
    }
  }, [isReportConfirmed, router]);

  useEffect(() => {
    if (!address) return;

    const initializeSelfApp = async () => {
      try {
        const app = new SelfAppBuilder({
          version: 2,
          appName: process.env.NEXT_PUBLIC_SELF_APP_NAME || "Self Workshop",
          scope: process.env.NEXT_PUBLIC_SELF_SCOPE || "self-workshop",
          endpoint: `${process.env.NEXT_PUBLIC_SELF_ENDPOINT}`,
          logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
          userId: `${address}`,
          endpointType: "staging_https",
          userIdType: "hex",
          userDefinedData: "Bonjour Cannes!",
          disclosures: {
            minimumAge: 18,
            nationality: true,
            gender: true,
          },
        }).build();

        setSelfApp(app);
        // setUniversalLink(getUniversalLink(app));
      } catch (error) {
        console.error("Failed to initialize Self app:", error);
      }
    };

    initializeSelfApp();
  }, [address]); // Make sure address is in the dependency array

  const displayToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const isLoading = isSubmitting || !!approvalHash || !!reportHash;

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY as string,
    libraries: ["places"],
  });

  // useEffect(() => {
  //   console.log("Places Status:", status, "Data:", data);
  // }, [status, data]);

  // if (!isLoaded) return <p>Loading...</p>;

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
      <h2 className="text-xl font-semibold mb-4">Report Lost Pet</h2>

      {/* Verification Section */}
      <div className="mb-8 p-4 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-medium mb-2">
          Identity Verification Required
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Scan this QR code with the Self app to verify your identity before
          reporting
        </p>

        {selfApp ? (
          <div className="flex justify-center">
            <SelfQRcodeWrapper
              selfApp={selfApp}
              onSuccess={() => {
                setIsVerified(true);
                toast.success("Identity verified successfully!");
              }}
              onError={() => {
                displayToast("Error: Failed to verify identity");
              }}
              size={150}
            />
          </div>
        ) : (
          <div className="w-[250px] h-[250px] mx-auto bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
            <p>Loading verification...</p>
          </div>
        )}

        {isVerified && (
          <p className="text-green-500 text-sm mt-2 text-center">
            ✓ Verification complete
          </p>
        )}
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Form fields remain the same as before */}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pet Name*
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Breed*
            </label>
            <input
              type="text"
              name="breed"
              value={formData.breed}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gender*
            </label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
              required
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Age (months)*
            </label>
            <input
              type="number"
              name="ageMonths"
              value={formData.ageMonths}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Size (cm)*
            </label>
            <input
              type="number"
              name="sizeCm"
              value={formData.sizeCm}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
              min="0"
              required
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date/Time Lost*
            </label>
            <input
              type="datetime-local"
              name="dateTimeLost"
              value={formData.dateTimeLost}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
              required
            />
          </div>

          {/* Last Seen Location with Autocomplete */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Seen Location*
            </label>
            <div className="relative">
              <input
                type="text"
                name="lastSeenLocation"
                value={formData.lastSeenLocation}
                onChange={(e) => {
                  setValue(e.target.value); // update places hook
                  setFormData({
                    ...formData,
                    lastSeenLocation: e.target.value,
                  });
                }}
                placeholder="Enter last seen address"
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
                required
              />

              {/* Suggestions */}
              {status === "OK" && (
                <ul className="absolute z-10 bg-white border border-gray-200 rounded-lg mt-1 w-full max-h-60 overflow-y-auto shadow-lg">
                  {data.map((suggestion) => {
                    const {
                      place_id,
                      structured_formatting: { main_text, secondary_text },
                      description,
                    } = suggestion;

                    return (
                      <li
                        key={place_id}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setValue(description, false);
                          clearSuggestions();
                          setFormData({
                            ...formData,
                            lastSeenLocation: description,
                          });

                          // Optionally get lat/lng for map usage
                          getGeocode({ address: description }).then(
                            (results) => {
                              const { lat, lng } = getLatLng(results[0]);
                              console.log("Lat/Lng:", lat, lng);
                            }
                          );
                        }}
                      >
                        <strong>{main_text}</strong>{" "}
                        <small className="text-gray-500">
                          {secondary_text}
                        </small>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description*
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
              rows={3}
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium text-sm mb-2">
              Pet Image *
            </label>
            <div
              className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex justify-center text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </p>
                {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
              </div>
            </div>

            {/* Single Preview Section */}
            {preview && (
              <div className="mt-4">
                <img
                  src={preview}
                  alt="Preview"
                  className="max-w-full h-auto max-h-60 rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setFile(null);
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-500"
                >
                  Remove image
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name*
            </label>
            <input
              type="text"
              name="contactName"
              value={formData.contactName}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone*
            </label>
            <input
              type="tel"
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="contactEmail"
              value={formData.contactEmail}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-400 focus:outline-none transition"
            />
          </div>
        </div>

        {/* Currency Selection */}
        <div className="space-y-2">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => handleSelectCurrency("CELO")}
              className={`px-4 py-2 rounded-lg ${
                !formData.useCUSD && !formData.useGDOLLAR
                  ? "bg-yellow-600 text-white"
                  : "bg-gray-200"
              }`}
            >
              Pay with CELO
            </button>
            <button
              type="button"
              onClick={() => handleSelectCurrency("CUSD")}
              className={`px-4 py-2 rounded-lg ${
                formData.useCUSD ? "bg-yellow-600 text-white" : "bg-gray-200"
              }`}
            >
              Pay with cUSD
            </button>
            <button
              type="button"
              onClick={() => handleSelectCurrency("G$")}
              className={`px-4 py-2 rounded-lg ${
                formData.useGDOLLAR ? "bg-yellow-600 text-white" : "bg-gray-200"
              }`}
            >
              Pay with G$
            </button>
          </div>

          {/* Bounty Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reward Amount (
              {formData.useCUSD ? "cUSD" : formData.useGDOLLAR ? "G$" : "CELO"}
              )*
            </label>
            <div className="relative">
              <input
                type="number"
                name={
                  formData.useCUSD
                    ? "cusdBounty"
                    : formData.useGDOLLAR
                    ? "gDollarBounty"
                    : "ethBounty"
                }
                value={
                  formData.useCUSD
                    ? formData.cusdBounty
                    : formData.useGDOLLAR
                    ? formData.gDollarBounty
                    : formData.ethBounty
                }
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
                min="0.001"
                step="0.001"
                required
              />
              <span className="absolute left-3 top-2 text-gray-500">
                {formData.useCUSD
                  ? "cUSD"
                  : formData.useGDOLLAR
                  ? "G$"
                  : "CELO"}
              </span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !isVerified}
          className={`w-full py-3 mt-4 rounded-xl font-semibold transition ${
            isLoading || !isVerified
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-yellow-600 text-white hover:bg-yellow-700"
          }`}
        >
          {isLoading
            ? "Processing..."
            : !isVerified
            ? "Complete Verification First"
            : "Report Lost Pet"}
        </button>

        <button
          type="submit"
          // disabled={isLoading || !isVerified}
          className={`w-full py-3 mt-4 rounded-xl font-semibold transition ${
            isLoading || !isVerified
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-yellow-600 text-white hover:bg-yellow-700"
          }`}
        >
          Report
          {/* {isLoading
            ? "Processing..."
            : !isVerified
            ? "Complete Verification First"
            : "Report Lost Pet"} */}
        </button>
      </form>
    </div>
  );
}
