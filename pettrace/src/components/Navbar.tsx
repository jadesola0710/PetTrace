"use client";
import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { injected } from "wagmi/connectors";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import Link from "next/link";

export default function Navbar() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const { connect } = useConnect();

  const { ready, user, authenticated, login, logout: logoutPrivy } = usePrivy();

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { disconnect: disconnectWagmi } = useDisconnect();

  // Detect MiniPay and auto-connect
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
      connect({ connector: injected({ target: "metaMask" }) });
    }
  }, [connect]);

  // Handle complete logout (both Privy and wagmi)
  const handleLogout = async () => {
    // Disconnect from wagmi first
    if (isConnected) {
      disconnectWagmi();
    }

    // Then logout from Privy
    logoutPrivy();
  };

  const displayAddress = address || user?.wallet?.address;

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

        {/* Auth + Wallet Connect Section */}
        <div>
          {!authenticated ? (
            <button
              onClick={login}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg text-xs hover:bg-orange-600 transition"
            >
              Login with Privy
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-gray-600 text-xs">
                {displayAddress
                  ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(
                      -4
                    )}`
                  : "Connected"}
              </span>
              <button
                onClick={handleLogout}
                className="bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-xs hover:bg-gray-300 transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
