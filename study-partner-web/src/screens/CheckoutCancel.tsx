'use client';
import React from "react";
import { Link, useNavigate } from "@/navigation";
import { XCircle } from "lucide-react";

export default function CheckoutCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0f1923] text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full rounded-2xl border border-[#ffffff12] bg-[#1a2633] p-8 text-center">
        <XCircle
          className="mx-auto mb-4 text-[var(--accent-color-dynamic)]"
          size={52}
        />
        <h1 className="text-2xl font-bold mb-2">Checkout canceled</h1>
        <p className="text-gray-400 mb-6">
          No charge was made. You can continue on your current plan or try
          again.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => navigate("/pricing")}
            className="px-4 py-2 rounded-lg bg-[var(--accent-color-dynamic)] hover:bg-[var(--accent-color-dynamic-hover)] transition-colors"
          >
            Back to pricing
          </button>
          <Link
            to="/dashboard"
            className="px-4 py-2 rounded-lg border border-[#ffffff20] hover:bg-[#ffffff0a] transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
