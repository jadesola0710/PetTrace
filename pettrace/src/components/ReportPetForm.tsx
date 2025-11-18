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
const CONTRACT_ADDRESS = "0xC7F94703677f5B3fBa1BcF81B1560364849Ce103";
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
  usdtBounty: string;
  gDollarBounty: string;
  useCUSD: boolean;
  useGDOLLAR: boolean;
  useUSDT: boolean;
}

// Notification Helper Functions
const showNotification = {
  // Connection & Network
  walletNotConnected: () => {
    toast.error("Please connect your wallet to continue", {
      duration: 4000,
      icon: "🔌",
    });
  },

  wrongNetwork: () => {
    toast.error("Please switch to Celo network", {
      duration: 5000,
      icon: "🌐",
    });
  },

  // Verification
  verificationSuccess: () => {
    toast.success("Identity verified successfully!", {
      duration: 3000,
      icon: "✅",
    });
  },

  verificationError: () => {
    toast.error("Failed to verify identity. Please try again.", {
      duration: 4000,
      icon: "❌",
    });
  },

  verificationRequired: () => {
    toast.error("Please complete identity verification first", {
      duration: 4000,
      icon: "🔒",
    });
  },

  // File Upload
  fileUploadSuccess: () => {
    toast.success("Image uploaded successfully", {
      duration: 2000,
      icon: "📸",
    });
  },

  fileValidationError: (error: string) => {
    toast.error(error, {
      duration: 4000,
      icon: "⚠️",
    });
  },

  // Transaction Progress
  approvingToken: (tokenName: string) => {
    return toast.loading(`Approving ${tokenName} spending...`, {
      icon: "⏳",
    });
  },

  approvalSuccess: (tokenName: string) => {
    toast.success(`${tokenName} approval confirmed!`, {
      duration: 3000,
      icon: "✓",
    });
  },

  reportingPet: () => {
    return toast.loading("Reporting lost pet to blockchain...", {
      icon: "📡",
    });
  },

  uploadingToIPFS: () => {
    return toast.loading("Uploading image to IPFS...", {
      icon: "☁️",
    });
  },

  // Success
  reportSuccess: () => {
    toast.success("Pet reported successfully! Redirecting to reports page...", {
      duration: 4000,
      icon: "🎉",
    });
  },

  // Errors
  transactionFailed: (error?: string) => {
    toast.error(error || "Transaction failed. Please try again.", {
      duration: 5000,
      icon: "❌",
    });
  },

  ipfsUploadFailed: () => {
    toast.error("Failed to upload image. Please try again.", {
      duration: 4000,
      icon: "☁️",
    });
  },

  // Form Validation
  missingField: (fieldName: string) => {
    toast.error(`Please fill in ${fieldName}`, {
      duration: 3000,
      icon: "📝",
    });
  },

  invalidBounty: () => {
    toast.error("Please enter a valid bounty amount greater than 0", {
      duration: 3000,
      icon: "💰",
    });
  },

  // Welcome
  welcome: () => {
    toast("Please connect your wallet to report a lost pet", {
      icon: "👋",
      duration: 4000,
    });
  },
};

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
    cusdBounty: "0.001",
    gDollarBounty: "0.001",
    usdtBounty: "0.001",
    useCUSD: false,
    useGDOLLAR: false,
    useUSDT: false,
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
  const handleSelectCurrency = (currency: "CELO" | "CUSD" | "G$" | "USDT") => {
    setFormData((prev) => ({
      ...prev,
      useCUSD: currency === "CUSD",
      useGDOLLAR: currency === "G$",
      useUSDT: currency === "USDT",
    }));
  };

  // Form validation
  const validateForm = () => {
    if (!address) {
      showNotification.walletNotConnected();
      return false;
    }

    // if (!isVerified) {
    //   showNotification.verificationRequired();
    //   return false;
    // }

    // Required fields check

    const requiredFields = {
      name: "Pet Name",
      breed: "Breed",
      gender: "Gender",
      sizeCm: "Size",
      ageMonths: "Age",
      dateTimeLost: "Date/Time Lost",
      description: "Description",
      lastSeenLocation: "Last Seen Location",
      contactName: "Contact Name",
      contactPhone: "Contact Phone",
    };

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!formData[field as keyof PetFormData]) {
        showNotification.missingField(label);
        return false;
      }
    }

    // Bounty validation
    let bountyAmount = "";
    if (formData.useCUSD) {
      bountyAmount = formData.cusdBounty;
    } else if (formData.useGDOLLAR) {
      bountyAmount = formData.gDollarBounty;
    } else if (formData.useUSDT) {
      bountyAmount = formData.usdtBounty;
    } else {
      bountyAmount = formData.ethBounty;
    }

    if (isNaN(parseFloat(bountyAmount)) || parseFloat(bountyAmount) <= 0) {
      showNotification.invalidBounty();
      return false;
    }

    if (!file) {
      showNotification.fileValidationError("Please upload a pet image");
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
      showNotification.walletNotConnected();
      return;
    }

    try {
      const amountInWei = parseEther(amount);
      const toastId = showNotification.approvingToken(tokenName);
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
      showNotification.transactionFailed(`Failed to approve ${tokenName}`);
      if (approvalToastId) {
        toast.dismiss(approvalToastId);
      }
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
      const errorMsg = "Only image files are allowed";
      setError(errorMsg);
      showNotification.fileValidationError(errorMsg);
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      const errorMsg = "File size must be less than 10MB";
      setError(errorMsg);
      showNotification.fileValidationError(errorMsg);
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      showNotification.fileUploadSuccess();
    };
    reader.readAsDataURL(selectedFile);
  };

  // IPFS upload
  const uploadToIPFS = async (file: File): Promise<string> => {
    const uploadToastId = showNotification.uploadingToIPFS();

    try {
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

      toast.dismiss(uploadToastId);

      if (response.status !== 200) {
        throw new Error("Failed to upload image");
      }

      return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
    } catch (error) {
      toast.dismiss(uploadToastId);
      showNotification.ipfsUploadFailed();
      throw error;
    }
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
  // const reportPet = async () => {
  //   if (!walletClient || !address) {
  //     showNotification.walletNotConnected();
  //     return;
  //   }

  //   try {
  //     const toastId = showNotification.reportingPet();
  //     setReportToastId(toastId);

  //     // Upload image
  //     const imageUrl = await uploadToIPFS(file!);
  //     const ipfsHash = imageUrl.split("/").pop() || "";
  //     if (ipfsHash.length > 200) throw new Error("Image URL too long");

  //     // Prepare bounty data
  //     let bountyAmount = "0";
  //     let bountyInWei = BigInt(0);
  //     let currency = "CELO";

  //     if (formData.useCUSD) {
  //       bountyAmount = formData.cusdBounty;
  //       bountyInWei = parseEther(bountyAmount);
  //       currency = "cUSD";
  //     } else if (formData.useGDOLLAR) {
  //       bountyAmount = formData.gDollarBounty;
  //       bountyInWei = parseEther(bountyAmount);
  //       currency = "G$";
  //     } else if (formData.useUSDT) {
  //       bountyAmount = formData.usdtBounty;
  //       bountyInWei = parseEther(bountyAmount);
  //       currency = "USDT";
  //     } else {
  //       bountyAmount = formData.ethBounty;
  //       bountyInWei = parseEther(bountyAmount);
  //     }

  //     // Generate referral tag
  //     const divviSuffix = getReferralTag(DIVVI_CONFIG);
  //     console.log("🎯 Divvi Suffix:", divviSuffix);

  //     // Encode contract call
  //     const encodedFunction = encodeFunctionData({
  //       abi: PetTraceABI.abi,
  //       functionName: "postLostPet",
  //       args: [
  //         formData.name,
  //         formData.breed,
  //         formData.gender,
  //         Number(formData.sizeCm),
  //         Number(formData.ageMonths),
  //         formData.dateTimeLost,
  //         formData.description,
  //         ipfsHash,
  //         formData.lastSeenLocation,
  //         formData.contactName,
  //         formData.contactPhone,
  //         formData.contactEmail,
  //         formData.useCUSD ? bountyInWei.toString() : "0",
  //         formData.useGDOLLAR ? bountyInWei.toString() : "0",
  //         formData.useUSDT ? bountyInWei.toString() : "0",
  //       ],
  //     });

  //     console.log("🎯 Encoded Function (before Divvi):", encodedFunction);

  //     const dataWithDivvi = (encodedFunction +
  //       (divviSuffix.startsWith("0x")
  //         ? divviSuffix.slice(2)
  //         : divviSuffix)) as `0x${string}`;

  //     console.log("🎯 Data with Divvi (after):", dataWithDivvi);
  //     console.log(
  //       "🎯 Divvi added:",
  //       dataWithDivvi.length > encodedFunction.length
  //     );

  //     // Send transaction
  //     const hash = await walletClient.sendTransaction({
  //       account: address,
  //       to: CONTRACT_ADDRESS,
  //       data: dataWithDivvi,
  //       value:
  //         formData.useCUSD || formData.useGDOLLAR || formData.useUSDT
  //           ? BigInt(0)
  //           : bountyInWei,
  //     });

  //     setReportHash(hash as `0x${string}`);

  //     // ✅ Log referral submission
  //     console.log("🎯 Submitting referral with:", {
  //       txHash: hash,
  //       chainId: chainId || 42220,
  //     });

  //     const referralResult = await submitReferral({
  //       txHash: hash,
  //       chainId: chainId || 42220,
  //     });

  //     console.log("✅ Referral Submission SUCCESS:", {
  //       result: referralResult,
  //       txHash: hash,
  //       timestamp: new Date().toISOString(),
  //     });

  //     return hash;
  //   } catch (error) {
  //     console.error("❌ Report pet error:", error);

  //     if (reportToastId) {
  //       toast.dismiss(reportToastId);
  //     }
  //     showNotification.transactionFailed();
  //     setReportToastId(null);
  //     throw error;
  //   }
  // };

  // Add this to your reportPet function in ReportPetForm.tsx

  const reportPet = async () => {
    if (!walletClient || !address) {
      showNotification.walletNotConnected();
      return;
    }

    try {
      const toastId = showNotification.reportingPet();
      setReportToastId(toastId);

      console.log("=== DIVVI INTEGRATION START ===");
      console.log("📍 User Address:", address);
      console.log("📍 Consumer Address:", DIVVI_CONFIG.consumer);

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
      } else if (formData.useUSDT) {
        bountyAmount = formData.usdtBounty;
        bountyInWei = parseEther(bountyAmount);
        currency = "USDT";
      } else {
        bountyAmount = formData.ethBounty;
        bountyInWei = parseEther(bountyAmount);
      }

      console.log("💰 Bounty Details:", {
        amount: bountyAmount,
        currency,
        inWei: bountyInWei.toString(),
      });

      // Generate referral tag
      console.log("🎯 Generating Divvi referral tag...");
      const divviSuffix = getReferralTag(DIVVI_CONFIG);

      console.log("✅ Divvi Suffix Generated:", {
        suffix: divviSuffix,
        length: divviSuffix.length,
        hasPrefix: divviSuffix.startsWith("0x"),
        raw: divviSuffix,
      });

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
          formData.useUSDT ? bountyInWei.toString() : "0",
        ],
      });

      console.log("📦 Encoded Function (BEFORE Divvi):", {
        data: encodedFunction,
        length: encodedFunction.length,
      });

      // Append Divvi suffix
      const dataWithDivvi = (encodedFunction +
        (divviSuffix.startsWith("0x")
          ? divviSuffix.slice(2)
          : divviSuffix)) as `0x${string}`;

      console.log("📦 Data WITH Divvi (AFTER):", {
        data: dataWithDivvi,
        length: dataWithDivvi.length,
        divviAdded: dataWithDivvi.length > encodedFunction.length,
        difference: dataWithDivvi.length - encodedFunction.length,
      });

      console.log("🔍 Divvi Integration Check:", {
        originalLength: encodedFunction.length,
        withDivviLength: dataWithDivvi.length,
        divviSuffixLength: divviSuffix.length,
        success: dataWithDivvi.length > encodedFunction.length,
      });

      // Send transaction
      console.log("📡 Sending transaction to blockchain...");
      const hash = await walletClient.sendTransaction({
        account: address,
        to: CONTRACT_ADDRESS,
        data: dataWithDivvi,
        value:
          formData.useCUSD || formData.useGDOLLAR || formData.useUSDT
            ? BigInt(0)
            : bountyInWei,
      });

      console.log("✅ Transaction Hash:", hash);
      setReportHash(hash as `0x${string}`);

      // Submit referral
      console.log("🎯 Submitting referral to Divvi...");
      console.log("Referral Params:", {
        txHash: hash,
        chainId: chainId || 42220,
      });

      try {
        const referralResult = await submitReferral({
          txHash: hash,
          chainId: chainId || 42220,
        });

        console.log("✅ Referral Submission SUCCESS:", {
          result: referralResult,
          txHash: hash,
          timestamp: new Date().toISOString(),
        });

        // Show success toast
        toast.success("Divvi referral submitted successfully!", {
          duration: 3000,
          icon: "🎉",
        });
      } catch (referralError) {
        console.error("❌ Referral Submission FAILED:", {
          error: referralError,
          message:
            referralError instanceof Error
              ? referralError.message
              : "Unknown error",
          txHash: hash,
          timestamp: new Date().toISOString(),
        });

        // Show warning toast (don't fail the whole transaction)
        toast.error("Transaction successful, but referral submission failed", {
          duration: 4000,
          icon: "⚠️",
        });
      }

      console.log("=== DIVVI INTEGRATION END ===");
      return hash;
    } catch (error) {
      console.error("❌ Report Pet Error:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (reportToastId) {
        toast.dismiss(reportToastId);
      }
      showNotification.transactionFailed();
      setReportToastId(null);
      throw error;
    }
  };

  // Optional: Add a debug component to monitor Divvi status
  // Add this to your component's return JSX if you want real-time status

  {
    /* Debug Panel (Remove in production) */
  }
  {
    process.env.NODE_ENV === "development" && (
      <div className="mb-4 p-4 bg-gray-100 rounded-lg">
        <h4 className="font-bold mb-2">Divvi Debug Info</h4>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(
            {
              user: address,
              consumer: DIVVI_CONFIG.consumer,
              chainId: chainId || 42220,
              reportHash: reportHash || "Not yet submitted",
            },
            null,
            2
          )}
        </pre>
      </div>
    );
  }

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
      if (formData.useUSDT) {
        await approveToken(GDOLLAR_ADDRESS, formData.gDollarBounty, "G$");
        return;
      }

      await reportPet();
    } catch (error) {
      showNotification.transactionFailed("Failed to submit pet report");
      setIsSubmitting(false);
    }
  };

  // Handle approval confirmation
  useEffect(() => {
    if (
      isApprovalConfirmed &&
      (formData.useCUSD || formData.useGDOLLAR || formData.useUSDT)
    ) {
      if (approvalToastId) {
        toast.dismiss(approvalToastId);
        setApprovalToastId(null);
      }

      const tokenName = formData.useCUSD ? "cUSD" : "G$";
      showNotification.approvalSuccess(tokenName);

      // Small delay to show approval success before reporting
      setTimeout(() => {
        reportPet();
      }, 1000);
    }
  }, [
    isApprovalConfirmed,
    formData.useCUSD,
    formData.useGDOLLAR,
    formData.useUSDT,
  ]);

  // Handle successful report
  useEffect(() => {
    if (isReportConfirmed) {
      if (reportToastId) {
        toast.dismiss(reportToastId);
        setReportToastId(null);
      }

      showNotification.reportSuccess();

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
        cusdBounty: "0.001",
        gDollarBounty: "0.001",
        usdtBounty: "0.001",
        useCUSD: false,
        useGDOLLAR: false,
        useUSDT: false,
      });
      setFile(null);
      setPreview(null);
      setIsVerified(false);

      setTimeout(() => router.push("/view_reports"), 2000);
    }
  }, [isReportConfirmed, router]);

  // Initialize Self app
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
      } catch (error) {
        console.error("Failed to initialize Self app:", error);
      }
    };

    initializeSelfApp();
  }, [address]);

  const isLoading = isSubmitting || !!approvalHash || !!reportHash;

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY as string,
    libraries: ["places"],
  });

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
                showNotification.verificationSuccess();
              }}
              onError={() => {
                showNotification.verificationError();
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
                  setValue(e.target.value);
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

            {/* Preview Section */}
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

            <button
              type="button"
              onClick={() => handleSelectCurrency("USDT")}
              className={`px-4 py-2 rounded-lg ${
                formData.useUSDT ? "bg-yellow-600 text-white" : "bg-gray-200"
              }`}
            >
              Pay with USDT
            </button>
          </div>

          {/* Bounty Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reward Amount (
              {formData.useCUSD
                ? "cUSD"
                : formData.useGDOLLAR
                ? "G$"
                : formData.useUSDT
                ? "USDT"
                : "CELO"}
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
                    : formData.useUSDT
                    ? "usdtBounty"
                    : "ethBounty"
                }
                value={
                  formData.useCUSD
                    ? formData.cusdBounty
                    : formData.useGDOLLAR
                    ? formData.gDollarBounty
                    : formData.useUSDT
                    ? formData.usdtBounty
                    : formData.ethBounty
                }
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-1 focus:ring-yellow-300 focus:outline-none transition"
                min="0.001"
                step="0.001"
                required
              />
              <span className="absolute right-3 top-3 text-gray-500 text-sm">
                {formData.useCUSD
                  ? "cUSD"
                  : formData.useGDOLLAR
                  ? "G$"
                  : formData.useUSDT
                  ? "USDT"
                  : "CELO"}
              </span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          // disabled={isLoading || !isVerified}
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
