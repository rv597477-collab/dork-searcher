/**
 * CAPTCHA Solver Service Integration
 * Supports 2Captcha, Anti-Captcha, and NopeCHA services
 */

export type SolverService = "2captcha" | "anticaptcha" | "nopecha";

export interface SolverConfig {
  apiKey: string;
  service: SolverService;
}

export interface CaptchaSolveResult {
  success: boolean;
  solution?: string;
  error?: string;
}

/**
 * Detect if the HTML contains a CAPTCHA challenge
 */
export function detectCaptcha(html: string): {
  hasCaptcha: boolean;
  captchaType?: "cloudflare" | "recaptcha" | "hcaptcha" | "generic";
  sitekey?: string;
} {
  const lower = html.toLowerCase();

  // Cloudflare Turnstile detection
  if (lower.includes("turnstile") || lower.includes("cf-challenge") || lower.includes("cf_chl_")) {
    const sitekeyMatch = html.match(/sitekey["\s:=]+([a-zA-Z0-9_-]+)/i);
    return {
      hasCaptcha: true,
      captchaType: "cloudflare",
      sitekey: sitekeyMatch?.[1],
    };
  }

  // reCAPTCHA detection
  if (lower.includes("recaptcha") || lower.includes("g-recaptcha")) {
    const sitekeyMatch = html.match(/data-sitekey["\s:=]+([a-zA-Z0-9_-]+)/i);
    return {
      hasCaptcha: true,
      captchaType: "recaptcha",
      sitekey: sitekeyMatch?.[1],
    };
  }

  // hCaptcha detection
  if (lower.includes("hcaptcha") || lower.includes("h-captcha")) {
    const sitekeyMatch = html.match(/data-sitekey["\s:=]+([a-zA-Z0-9_-]+)/i);
    return {
      hasCaptcha: true,
      captchaType: "hcaptcha",
      sitekey: sitekeyMatch?.[1],
    };
  }

  // Generic CAPTCHA indicators
  if (
    lower.includes("captcha") ||
    lower.includes("challenge-form") ||
    lower.includes("security check")
  ) {
    return {
      hasCaptcha: true,
      captchaType: "generic",
    };
  }

  return { hasCaptcha: false };
}

/**
 * Solve CAPTCHA using 2Captcha service
 */
async function solve2Captcha(
  sitekey: string,
  pageUrl: string,
  apiKey: string,
  captchaType: string
): Promise<CaptchaSolveResult> {
  try {
    // Submit CAPTCHA task
    const submitUrl = `https://2captcha.com/in.php`;
    const params = new URLSearchParams({
      key: apiKey,
      method: captchaType === "cloudflare" ? "turnstile" : captchaType === "hcaptcha" ? "hcaptcha" : "userrecaptcha",
      sitekey: sitekey,
      pageurl: pageUrl,
      json: "1",
    });

    const submitResponse = await fetch(`${submitUrl}?${params.toString()}`);
    const submitData = await submitResponse.json();

    if (submitData.status !== 1) {
      return {
        success: false,
        error: submitData.request || "Failed to submit CAPTCHA task",
      };
    }

    const taskId = submitData.request;

    // Poll for solution (max 120 seconds)
    const maxAttempts = 40;
    const pollInterval = 3000; // 3 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const resultUrl = `https://2captcha.com/res.php`;
      const resultParams = new URLSearchParams({
        key: apiKey,
        action: "get",
        id: taskId,
        json: "1",
      });

      const resultResponse = await fetch(`${resultUrl}?${resultParams.toString()}`);
      const resultData = await resultResponse.json();

      if (resultData.status === 1) {
        return {
          success: true,
          solution: resultData.request,
        };
      }

      if (resultData.request !== "CAPCHA_NOT_READY") {
        return {
          success: false,
          error: resultData.request || "Unknown error",
        };
      }
    }

    return {
      success: false,
      error: "Timeout: CAPTCHA solving took too long",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "2Captcha service error",
    };
  }
}

/**
 * Solve CAPTCHA using Nopecha service
 */
async function solveNopecha(
  sitekey: string,
  pageUrl: string,
  apiKey: string,
  captchaType: 'turnstile' | 'hcaptcha' | 'recaptcha'
): Promise<CaptchaSolveResult> {
  try {
    // Submit CAPTCHA task
    const submitUrl = `https://api.nopecha.com/`;
    const submitPayload = {
      type: captchaType,
      sitekey: sitekey,
      url: pageUrl,
      key: apiKey,
    };

    const submitResponse = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submitPayload),
    });

    const submitData = await submitResponse.json();

    if (!submitData.data) {
      return {
        success: false,
        error: submitData.error || submitData.message || "Failed to submit CAPTCHA task",
      };
    }

    const taskId = submitData.data;

    // Poll for solution (max 120 seconds)
    const maxAttempts = 40;
    const pollInterval = 3000; // 3 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const resultUrl = `https://api.nopecha.com/?key=${apiKey}&id=${taskId}`;

      const resultResponse = await fetch(resultUrl);
      const resultData = await resultResponse.json();

      if (resultData.error) {
        return {
          success: false,
          error: resultData.error || resultData.message || "Unknown error",
        };
      }

      if (resultData.data && resultData.data !== "processing") {
        return {
          success: true,
          solution: resultData.data,
        };
      }

      // Continue polling if still processing
      if (resultData.data === "processing") {
        continue;
      }
    }

    return {
      success: false,
      error: "Timeout: CAPTCHA solving took too long",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Nopecha service error",
    };
  }
}

/**
 * Solve CAPTCHA using Anti-Captcha service
 */
async function solveAntiCaptcha(
  sitekey: string,
  pageUrl: string,
  apiKey: string,
  captchaType: string
): Promise<CaptchaSolveResult> {
  try {
    // Submit CAPTCHA task
    const submitUrl = `https://api.anti-captcha.com/createTask`;

    let taskType = "RecaptchaV2TaskProxyless";
    if (captchaType === "cloudflare") {
      taskType = "TurnstileTaskProxyless";
    } else if (captchaType === "hcaptcha") {
      taskType = "HCaptchaTaskProxyless";
    }

    const submitPayload = {
      clientKey: apiKey,
      task: {
        type: taskType,
        websiteURL: pageUrl,
        websiteKey: sitekey,
      },
    };

    const submitResponse = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submitPayload),
    });

    const submitData = await submitResponse.json();

    if (submitData.errorId !== 0) {
      return {
        success: false,
        error: submitData.errorDescription || "Failed to submit CAPTCHA task",
      };
    }

    const taskId = submitData.taskId;

    // Poll for solution (max 120 seconds)
    const maxAttempts = 40;
    const pollInterval = 3000; // 3 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const resultUrl = `https://api.anti-captcha.com/getTaskResult`;
      const resultPayload = {
        clientKey: apiKey,
        taskId: taskId,
      };

      const resultResponse = await fetch(resultUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resultPayload),
      });

      const resultData = await resultResponse.json();

      if (resultData.errorId !== 0) {
        return {
          success: false,
          error: resultData.errorDescription || "Unknown error",
        };
      }

      if (resultData.status === "ready") {
        return {
          success: true,
          solution: resultData.solution?.token || resultData.solution?.gRecaptchaResponse,
        };
      }

      if (resultData.status !== "processing") {
        return {
          success: false,
          error: `Unexpected status: ${resultData.status}`,
        };
      }
    }

    return {
      success: false,
      error: "Timeout: CAPTCHA solving took too long",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Anti-Captcha service error",
    };
  }
}

/**
 * Main solver function - dispatches to appropriate service
 */
export async function solveCaptcha(
  pageUrl: string,
  html: string,
  config: SolverConfig
): Promise<CaptchaSolveResult> {
  const detection = detectCaptcha(html);

  if (!detection.hasCaptcha) {
    return {
      success: false,
      error: "No CAPTCHA detected in page",
    };
  }

  if (!detection.sitekey) {
    return {
      success: false,
      error: `CAPTCHA detected (${detection.captchaType}) but no sitekey found`,
    };
  }

  const captchaType = detection.captchaType || "generic";

  if (config.service === "2captcha") {
    return await solve2Captcha(detection.sitekey, pageUrl, config.apiKey, captchaType);
  } else if (config.service === "anticaptcha") {
    return await solveAntiCaptcha(detection.sitekey, pageUrl, config.apiKey, captchaType);
  } else if (config.service === "nopecha") {
    // Map to NopeCHA-specific types
    let nopechaCaptchaType: 'turnstile' | 'hcaptcha' | 'recaptcha' = 'recaptcha';
    if (captchaType === "cloudflare") {
      nopechaCaptchaType = "turnstile";
    } else if (captchaType === "hcaptcha") {
      nopechaCaptchaType = "hcaptcha";
    }
    return await solveNopecha(detection.sitekey, pageUrl, config.apiKey, nopechaCaptchaType);
  }

  return {
    success: false,
    error: "Unknown solver service",
  };
}
