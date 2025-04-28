"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";
import { celo, celoAlfajores } from "wagmi/chains";
import { toast } from "react-hot-toast";
import PetTraceABI from "../../abi.json";
import { erc20Abi } from "viem";

const CONTRACT_ADDRESS = "0x089eeB78cB2c4820C458759c77C43aea8ee2CF8c";
const CUSD_ADDRESS = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [approvalToastId, setApprovalToastId] = useState<string | null>(null);
  const [reportToastId, setReportToastId] = useState<string | null>(null);

  // Approval hooks
  const {
    writeContract: writeApproval,
    data: approvalHash,
    isPending: isApproving,
  } = useWriteContract();

  // Report hooks
  const {
    writeContract: writeReport,
    data: reportHash,
    isPending: isReporting,
  } = useWriteContract();

  // Approval confirmation
  const { isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalHash,
  });

  // Report confirmation
  const { isSuccess: isReportConfirmed } = useWaitForTransactionReceipt({
    hash: reportHash,
  });

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

  // Check network
  useEffect(() => {
    setIsCorrectNetwork(chainId === celo.id || chainId === celoAlfajores.id);
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
    const amountInWei = parseEther(amount);
    try {
      if (approvalToastId) {
        toast.dismiss(approvalToastId);
      }

      const toastId = toast.loading("Approving cUSD spending...");
      setApprovalToastId(toastId);

      writeApproval({
        address: CUSD_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, amountInWei],
      });
    } catch (error) {
      console.error("Approval failed:", error);
      toast.error("Failed to approve cUSD spending");
      setApprovalToastId(null);
    }
  };

  const reportPet = async () => {
    try {
      if (reportToastId) {
        toast.dismiss(reportToastId);
      }

      const toastId = toast.loading("Reporting lost pet...");
      setReportToastId(toastId);

      const bountyAmount = formData.useCUSD
        ? formData.cusdBounty
        : formData.ethBounty;
      const bountyInWei = parseEther(bountyAmount);

      const args = [
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
      ];

      writeReport({
        address: CONTRACT_ADDRESS,
        abi: PetTraceABI.abi,
        functionName: "postLostPet",
        args: args,
        value: formData.useCUSD ? BigInt(0) : bountyInWei,
      });
    } catch (error) {
      console.error("Error reporting pet:", error);
      toast.error("Failed to report pet");
      setReportToastId(null);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (formData.useCUSD) {
        await approveCUSD(formData.cusdBounty);
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
    if (isApprovalConfirmed && formData.useCUSD) {
      // Dismiss the approval toast
      if (approvalToastId) {
        toast.dismiss(approvalToastId);
        setApprovalToastId(null);
      }
      reportPet(); // Proceed to pet reporting after approval
    }
  }, [isApprovalConfirmed, formData.useCUSD]);

  // Handle successful report
  useEffect(() => {
    if (isReportConfirmed) {
      // Dismiss the report toast
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
        router.push("/view_reports");
      }, 1500);
      // router.push("/view_reports");
    }
  }, [isReportConfirmed, router]);

  const isLoading = isSubmitting || isApproving || isReporting;

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
      <h2 className="text-xl font-semibold mb-4">Report Lost Pet</h2>

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

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 mt-4 rounded-xl font-semibold transition ${
            isLoading
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-yellow-600 text-white hover:bg-yellow-700"
          }`}
        >
          {isLoading ? "Processing..." : "Report Lost Pet"}
        </button>
      </form>
    </div>
  );
}
