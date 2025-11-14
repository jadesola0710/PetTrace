import { NextRequest, NextResponse } from "next/server";
import {
  SelfBackendVerifier,
  AllIds,
  DefaultConfigStore,
  VerificationConfig,
} from "@selfxyz/core";

const disclosures_config: VerificationConfig = {
  excludedCountries: [],
  ofac: false,
  minimumAge: 18,
};

const configStore = new DefaultConfigStore(disclosures_config);

const selfBackendVerifier = new SelfBackendVerifier(
  "pet-trace",
  process.env.NEXT_PUBLIC_SELF_ENDPOINT || "",
  true,
  AllIds,
  configStore,
  "hex"
);

export async function POST(req: NextRequest) {
  console.log("Received request");
  console.log(req);
  try {
    const { attestationId, proof, publicSignals, userContextData } =
      await req.json();

    if (!proof || !publicSignals || !attestationId || !userContextData) {
      return NextResponse.json(
        {
          message:
            "Proof, publicSignals, attestationId and userContextData are required",
        },
        { status: 200 }
      );
    }

    const result = await selfBackendVerifier.verify(
      attestationId,
      proof,
      publicSignals,
      userContextData
    );

    if (result.isValidDetails.isValid) {
      return NextResponse.json({
        status: "success",
        result: true,
        credentialSubject: result.discloseOutput,
      });
    } else {
      //verfication failed
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: "Verification failed",
          error_code: "VERIFICATION_FAILED",
          details: result.isValidDetails,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error verifying proof:", error);
    return NextResponse.json(
      {
        status: "error",
        result: false,
        reason: error instanceof Error ? error.message : "Unknown error",
        error_code: "UNKNOWN_ERROR",
      },
      { status: 200 }
    );
  }
}
