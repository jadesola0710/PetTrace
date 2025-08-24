"use client";
import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { injected } from "wagmi/connectors";
import { useAccount, useConnect } from "wagmi";
import Link from "next/link";

export default function Navbar() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const { connect } = useConnect();

  // Detect MiniPay and auto-connect
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
      connect({ connector: injected({ target: "metaMask" }) });
    }
  }, [connect]);

  return (
    <header className="bg-white shadow-md px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/">
          <span className="text-xl font-bold text-gray-800 cursor-pointer">
            🐾PetTrace
          </span>
        </Link>
        {/* <div className="flex items-center gap-1 text-gray-600">
          <HiOutlineLocationMarker className="w-5 h-5" />
          <span>Харків</span>
        </div> */}
      </div>
      {/* Only show ConnectButton if not in MiniPay */}
      {!isMiniPay && <ConnectButton />}
      {/* <ConnectButton /> */}
    </header>
  );
}
