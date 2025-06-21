// app/api/verify/route.ts
import { NextResponse } from 'next/server';
import { getUserIdentifier, SelfBackendVerifier } from '@selfxyz/core';
import { url } from 'inspector';

export async function POST(request: Request) {
  try {
    const { proof, publicSignals } = await request.json();

    if (!proof || !publicSignals) {
      return NextResponse.json(
        { message: 'Proof and publicSignals are required' },
        { status: 400 }
      );
    }

    const URL = process.env.NEXT_PUBLIC_SELF_ENDPOINT;
    const userId = await getUserIdentifier(publicSignals);
    console.log("Extracted userId:", userId);

    const selfBackendVerifier = new SelfBackendVerifier(
      'pet-trace',
      `${URL}/api/verify`,
      "hex",
      process.env.NEXT_PUBLIC_SELF_ENABLE_MOCK_PASSPORT === "true"
    );

    const result = await selfBackendVerifier.verify(proof, publicSignals);
    
    if (result.isValid) {
      return NextResponse.json({
        status: 'success',
        result: true,
        credentialSubject: result.credentialSubject
      });
    } else {
      return NextResponse.json({
        status: 'error',
        result: false,
        message: 'Verification failed',
        details: result.isValidDetails
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error verifying proof:', error);
    return NextResponse.json({
      status: 'error',
      result: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Optional: Reject other methods
export async function GET() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { message: 'Method not allowed' },
    { status: 405 }
  );
}