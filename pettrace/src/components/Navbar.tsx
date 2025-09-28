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
      </div>
      <div className="flex items-center">
        <Link href="/view_reports">
          <div className="border border-yellow-600 text-yellow-600 hover:bg-yellow-50 px-6 py-3 mr-4 rounded-xl font-medium transition-colors shadow-sm flex items-center justify-center">
            <span>View Lost Pets</span>
          </div>
        </Link>
        {/* Only show ConnectButton if not in MiniPay */}
        {!isMiniPay && <ConnectButton />}
        {/* <ConnectButton /> */}
      </div>
    </header>
  );
}
