"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "@privy-io/wagmi";
import { createConfig } from "@privy-io/wagmi";
import { celo } from "wagmi/chains";
import { http } from "wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import {
  PrivyClientConfig,
  PrivyProvider,
  usePrivy,
} from "@privy-io/react-auth";
import { useEffect } from "react";

export const config = createConfig({
  chains: [celo],
  transports: {
    [celo.id]: http(),
  },
  ssr: true,
});

const privyConfig: PrivyClientConfig = {
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
    // requireUserPasswordOnCreate: true,
    // noPromptOnSignature: false,
  },
  loginMethods: ["wallet", "email", "sms"],
  appearance: {
    showWalletLoginFirst: true,
  },
  defaultChain: celo,
  supportedChains: [celo],
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // apiUrl={process.env.NEXT_PUBLIC_PRIVY_AUTH_URL as string}
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
        config={privyConfig}
      >
        <WagmiProvider config={config}>
          <PrivyInitializationTracker>{children}</PrivyInitializationTracker>
        </WagmiProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
}

function PrivyInitializationTracker({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, authenticated } = usePrivy();

  useEffect(() => {
    console.log("Privy State Changed:", { ready, authenticated });
  }, [ready, authenticated]);

  return <>{children}</>;
}
