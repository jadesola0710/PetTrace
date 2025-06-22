"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { getDataSuffix, submitReferral } from "@divvi/referral-sdk";
import SelfQRcodeWrapper, {
  SelfAppBuilder,
  type SelfApp,
} from "@selfxyz/qrcode";

const CONTRACT_ADDRESS = "0x850388b814B69ec4Da3cB3ac7637768adf9A0B00";
const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

interface PetFormData {
  name: string;
  breed: string;
  gender: string;
  sizeCm: string;
  ageMonths: string;
  dateTimeLost: string;
  description: string;
  imageUrl: string;
  lastSeenLocation: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  ethBounty: string;
  cusdBounty: string;
  useCUSD: boolean;
}

export default function ReportPetForm() {
  const router = useRouter();
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [approvalToastId, setApprovalToastId] = useState<string | null>(null);
  const [reportToastId, setReportToastId] = useState<string | null>(null);
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | undefined>();
  const [reportHash, setReportHash] = useState<`0x${string}` | undefined>();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const [formData, setFormData] = useState<PetFormData>({
    name: "",
    breed: "",
    gender: "",
    sizeCm: "",
    ageMonths: "",
    dateTimeLost: "",
    description: "",
    imageUrl: "",
    lastSeenLocation: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    ethBounty: "0.1",
    cusdBounty: "1",
    useCUSD: false,
  });

  // Transaction confirmation hooks
  const { isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalHash,
  });

  const { isSuccess: isReportConfirmed } = useWaitForTransactionReceipt({
    hash: reportHash,
  });

  // Check network
  useEffect(() => {
    setIsCorrectNetwork(chainId === celo.id);
  }, [chainId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleCurrency = () => {
    setFormData((prev) => ({ ...prev, useCUSD: !prev.useCUSD }));
  };

  const validateForm = () => {
    if (!address) {
      toast.error("Please connect your wallet");
      return false;
    }

    if (!isCorrectNetwork) {
      toast.error("Please switch to Celo network");
      return false;
    }

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

    if (!formData.imageUrl) {
      toast.error("Please provide an image URL");
      return false;
    }

    const bounty = formData.useCUSD ? formData.cusdBounty : formData.ethBounty;
    if (isNaN(parseFloat(bounty))) {
      toast.error("Please enter a valid bounty amount");
      return false;
    }

    if (parseFloat(bounty) <= 0) {
      toast.error("Bounty amount must be greater than 0");
      return false;
    }

    return true;
  };

  const approveCUSD = async (amount: string) => {
    console.log("[APPROVAL] Starting cUSD approval", { amount });

    if (!walletClient || !address) {
      console.error("[APPROVAL ERROR] Wallet not connected");
      toast.error("Wallet not connected");
      return;
    }

    try {
      const amountInWei = parseEther(amount);
      console.log("[APPROVAL] Amount in wei:", amountInWei.toString());

      if (approvalToastId) {
        toast.dismiss(approvalToastId);
      }

      const toastId = toast.loading("Approving cUSD spending...");
      setApprovalToastId(toastId);

      const approvalData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, amountInWei],
      });

      console.log("[APPROVAL] Encoded approval data:", approvalData);

      console.log("[APPROVAL] Sending transaction...");
      const hash = await walletClient.sendTransaction({
        account: address,
        to: CUSD_ADDRESS,
        data: approvalData,
      });

      console.log("[APPROVAL] Transaction sent, hash:", hash);
      setApprovalHash(hash as `0x${string}`);

      return hash;
    } catch (error) {
      console.error("[APPROVAL ERROR]", error);
      toast.error("Failed to approve cUSD spending");
      setApprovalToastId(null);
      throw error;
    }
  };

  const reportPet = async () => {
    console.log("[REPORT] Starting pet report");

    try {
      if (!walletClient || !address) {
        console.error("[REPORT ERROR] Wallet not connected");
        toast.error("Wallet not connected");
        return;
      }

      if (reportToastId) {
        toast.dismiss(reportToastId);
      }

      const toastId = toast.loading("Reporting lost pet...");
      setReportToastId(toastId);

      const bountyAmount = formData.useCUSD
        ? formData.cusdBounty
        : formData.ethBounty;
      const bountyInWei = parseEther(bountyAmount);

      console.log("[REPORT] Bounty:", {
        amount: bountyAmount,
        inWei: bountyInWei.toString(),
        currency: formData.useCUSD ? "cUSD" : "CELO",
      });

      console.log("[REPORT] Generating Divvi suffix...");
      const divviSuffix = getDataSuffix({
        consumer: "0x124D8fad33E0b9fe9F3e1E90D0fC0055aBE8cA8d",
        providers: [
          "0x0423189886d7966f0dd7e7d256898daeee625dca",
          "0xc95876688026be9d6fa7a7c33328bd013effa2bb",
          "0x5f0a55fad9424ac99429f635dfb9bf20c3360ab8",
        ],
      });
      console.log("[REPORT] Divvi suffix:", divviSuffix);

      console.log("[REPORT] Encoding function...");
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
          formData.imageUrl,
          formData.lastSeenLocation,
          formData.contactName,
          formData.contactPhone,
          formData.contactEmail,
          formData.useCUSD ? bountyInWei.toString() : "0",
        ],
      });
      console.log("[REPORT] Encoded function:", encodedFunction);

      const dataWithDivvi = (encodedFunction +
        (divviSuffix.startsWith("0x")
          ? divviSuffix.slice(2)
          : divviSuffix)) as `0x${string}`;
      console.log("[REPORT] Combined data with Divvi suffix:", dataWithDivvi);

      console.log("[REPORT] Sending transaction...");
      const hash = await walletClient.sendTransaction({
        account: address,
        to: CONTRACT_ADDRESS,
        data: dataWithDivvi,
        value: formData.useCUSD ? BigInt(0) : bountyInWei,
      });
      console.log("[REPORT] Transaction sent, hash:", hash);

      setReportHash(hash as `0x${string}`);

      console.log("[REPORT] Submitting to Divvi...");
      await submitReferral({
        txHash: hash,
        chainId: chainId || 42220,
      });
      console.log("[REPORT] Successfully submitted to Divvi");

      return hash;
    } catch (error) {
      console.error("[REPORT ERROR]", error);
      toast.error("Failed to report pet");
      setReportToastId(null);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[SUBMIT] Form submission started");

    if (!validateForm()) {
      console.log("[SUBMIT] Form validation failed");
      return;
    }

    setIsSubmitting(true);
    console.log("[SUBMIT] isSubmitting set to true");

    try {
      if (formData.useCUSD) {
        console.log("[SUBMIT] Using cUSD, starting approval flow");
        await approveCUSD(formData.cusdBounty);
        return;
      }

      console.log("[SUBMIT] Using CELO, starting report flow");
      await reportPet();
    } catch (error) {
      console.error("[SUBMIT ERROR]", error);
      toast.error("Failed to submit pet report");
      setIsSubmitting(false);
    }
  };

  // Handle approval confirmation
  useEffect(() => {
    if (isApprovalConfirmed && formData.useCUSD) {
      console.log("[APPROVAL CONFIRMED] Proceeding to report pet");

      if (approvalToastId) {
        toast.dismiss(approvalToastId);
        setApprovalToastId(null);
      }

      const toastId = toast.loading("Reporting lost pet after approval...");
      setReportToastId(toastId);

      reportPet();
    }
  }, [isApprovalConfirmed, formData.useCUSD]);

  // Handle successful report
  useEffect(() => {
    if (isReportConfirmed) {
      console.log("[REPORT CONFIRMED] Transaction successful");

      if (reportToastId) {
        toast.dismiss(reportToastId);
        setReportToastId(null);
      }

      toast.success("Pet reported successfully!");

      console.log("[REPORT CONFIRMED] Resetting form");
      setFormData({
        name: "",
        breed: "",
        gender: "",
        sizeCm: "",
        ageMonths: "",
        dateTimeLost: "",
        description: "",
        imageUrl: "",
        lastSeenLocation: "",
        contactName: "",
        contactPhone: "",
        contactEmail: "",
        ethBounty: "0.1",
        cusdBounty: "1",
        useCUSD: false,
      });

      setTimeout(() => {
        console.log("[NAVIGATION] Redirecting to /view_reports");
        router.push("/view_reports");
      }, 1500);
    }
  }, [isReportConfirmed, router]);

  const isLoading = isSubmitting || !!approvalHash || !!reportHash;

  const url = process.env.NEXT_PUBLIC_SELF_ENDPOINT;

  useEffect(() => {
    if (!address) return;
    try {
      const userId = `${address}`;
      const app = new SelfAppBuilder({
        appName: "PetTrace",
        scope: "pet-trace",
        endpoint: `${url}/api/verify`,
        userId,
        userIdType: "hex",
      }).build();

      setSelfApp(app);
    } catch (error) {
      console.error("Failed to initialize Self app:", error);
    }
  }, [address]);

  const displayToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSuccessfulVerification = () => {
    displayToast("Verification successful! You can now register.");
    console.log(true);
  };

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Seen Location*
            </label>
            <input
              type="text"
              name="lastSeenLocation"
              value={formData.lastSeenLocation}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
              required
            />
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image URL*
            </label>
            <input
              type="url"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
              placeholder="https://example.com/pet.jpg"
              required
            />
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

        <div className="space-y-2">
          <div className="flex items-center">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.useCUSD}
                onChange={handleToggleCurrency}
                className="sr-only peer"
              />
              <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
              <span className="ml-3 text-sm font-medium">
                {formData.useCUSD ? "Pay with cUSD" : "Pay with CELO"}
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reward Amount ({formData.useCUSD ? "cUSD" : "CELO"})*
            </label>
            <div className="relative">
              <input
                type="number"
                name={formData.useCUSD ? "cusdBounty" : "ethBounty"}
                value={
                  formData.useCUSD ? formData.cusdBounty : formData.ethBounty
                }
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
                min="0.1"
                step="0.01"
                required
              />
              <span className="absolute left-3 top-2 text-gray-500">
                {formData.useCUSD ? "cUSD" : "CELO"}
              </span>
            </div>
          </div>
        </div>

        {/* <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 mt-4 rounded-xl font-semibold transition ${
            isLoading
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-yellow-600 text-white hover:bg-yellow-700"
          }`}
        >
          {isLoading ? "Processing..." : "Report Lost Pet"}
        </button> */}
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
      </form>
    </div>
  );
}
