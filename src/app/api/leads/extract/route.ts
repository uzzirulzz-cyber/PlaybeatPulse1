// PlayBeat — Start a new extraction job (creates a Campaign)
// POST /api/leads/extract
// Body: { category, city, country, target, sources?, requiredFields?, verificationLevel? }
// CRITICAL: target is enforced to >= 1000 via enforceMinimumTarget (Rule 1).
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/_lib/auth-guard";
import { db } from "@/lib/db";
import { enforceMinimumTarget, audit } from "@/lib/rules";
import { getClientIp } from "@/lib/auth";
import { serializeCampaign, stringifyJson } from "@/app/api/_lib/serialize";

export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin(req);
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const {
      category,
      city,
      country,
      target,
      sources,
      requiredFields,
      verificationLevel,
    } = body as {
      category?: string;
      city?: string;
      country?: string;
      target?: number;
      sources?: string[];
      requiredFields?: string[];
      verificationLevel?: string;
    };

    // Validate required inputs
    if (!category || typeof category !== "string" || !category.trim()) {
      return NextResponse.json(
        { error: "category is required" },
        { status: 400 }
      );
    }
    if (!city || typeof city !== "string" || !city.trim()) {
      return NextResponse.json(
        { error: "city is required" },
        { status: 400 }
      );
    }
    if (!country || typeof country !== "string" || !country.trim()) {
      return NextResponse.json(
        { error: "country is required" },
        { status: 400 }
      );
    }
    if (target === undefined || target === null || typeof target !== "number") {
      return NextResponse.json(
        { error: "target is required and must be a number" },
        { status: 400 }
      );
    }

    // RULE 1: enforce minimum target of 1000 (server-side, cannot be bypassed)
    const enforcedTarget = enforceMinimumTarget(target);

    const name = `${category} in ${city}, ${country}`;

    const campaign = await db.campaign.create({
      data: {
        name,
        locationFilters: stringifyJson({ country, city }),
        businessFilters: stringifyJson({
          nature: category,
          ...(sources && Array.isArray(sources) && sources.length
            ? { sources }
            : {}),
        }),
        contactFilters: stringifyJson(
          requiredFields && Array.isArray(requiredFields) && requiredFields.length
            ? { requiredFields }
            : {}
        ),
        qualityFilters: stringifyJson(
          verificationLevel
            ? { verificationLevel }
            : {}
        ),
        target: enforcedTarget,
        status: "queued",
        progress: 0,
        userId: null,
      },
    });

    await audit({
      adminId: admin!.id,
      action: "extraction.start",
      entity: "campaign",
      entityId: campaign.id,
      detail: `${category}/${city}/${country} target=${enforcedTarget}`,
      ip: getClientIp(req),
      campaignId: campaign.id,
    });

    return NextResponse.json(serializeCampaign(campaign), { status: 201 });
  } catch (err: any) {
    console.error("[leads.extract] error", err);
    return NextResponse.json(
      { error: "Failed to start extraction job" },
      { status: 500 }
    );
  }
}
