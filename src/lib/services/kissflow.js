/**
 * KISSFLOW SERVICE MODULE
 * Handles all Kissflow SDK operations: Create, Read, Query, Update
 *
 * DECISION: REFACTOR from App.js
 * Moved sendKissflowCreateRequest and generalized for all flows
 */

import KFSDK from "@kissflow/lowcode-client-sdk";
import { getFlowConfig, isActionAllowedForFlow } from "../../config/flows";

let kfSDKInstance = null;

export async function getKissflowSDK() {
  if (!kfSDKInstance) {
    try {
      kfSDKInstance = await KFSDK.initialize();
    } catch (err) {
      console.error("❌ Kissflow SDK initialization failed:", err);
      kfSDKInstance = null;
    }
  }
  return kfSDKInstance;
}

export async function getUserInfoFromKissflow() {
  try {
    const kf = await getKissflowSDK();
    if (!kf) {
      throw new Error("Kissflow SDK not initialized");
    }

    const { userId, accountId, name, email } = kf.user || {};

    if (!userId) {
      throw new Error("User information not available");
    }

    return {
      userId,
      accountId,
      name,
      email,
      loadedAt: Date.now(),
    };
  } catch (error) {
    console.error("❌ Failed to get user info:", error);
    throw error;
  }
}

export function validateActionForFlow(flowKey, action) {
  if (!isActionAllowedForFlow(flowKey, action)) {
    throw new Error(`Action '${action}' not allowed for flow '${flowKey}'`);
  }
}

export async function createKissflowItem(request, flowKey, userInfo) {
  validateActionForFlow(flowKey, "CREATE");

  const flow = getFlowConfig(flowKey);
  const processId = flow.kissflowProcessIds[0];

  if (!processId) {
    throw new Error(`No Kissflow process configured for ${flowKey} flow`);
  }

  try {
    const kf = await getKissflowSDK();
    if (!kf) {
      throw new Error("Kissflow SDK not initialized");
    }

    console.log(`📤 Creating Kissflow item in ${flowKey}...`);

    // TODO: Implement actual Kissflow creation API call
    console.log("🔄 TODO: Implement Kissflow creation");

    return {
      id: `item_${Date.now()}`,
      flowKey,
      created: true,
    };
  } catch (error) {
    console.error(`❌ Failed to create Kissflow item:`, error);
    throw error;
  }
}

export async function queryKissflowDataset(datasetQuery, userInfo) {
  try {
    const kf = await getKissflowSDK();
    if (!kf) {
      throw new Error("Kissflow SDK not initialized");
    }

    console.log(`📊 Querying Kissflow dataset...`);

    // TODO: Implement actual dataset query
    console.log("🔄 TODO: Implement Kissflow dataset query");

    return {
      items: [],
      totalCount: 0,
      hasMore: false,
    };
  } catch (error) {
    console.error("❌ Failed to query Kissflow dataset:", error);
    throw error;
  }
}

export async function validateKissflowAvailability() {
  try {
    const kf = await getKissflowSDK();
    if (!kf) {
      return {
        available: false,
        error: "Kissflow SDK not initialized",
      };
    }
    return {
      available: true,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      error: error.message || "Kissflow validation failed",
    };
  }
}

export async function openKissflowPopup(itemId) {
  try {
    const kf = await getKissflowSDK();
    if (!kf) {
      throw new Error("Kissflow SDK not initialized");
    }
    console.log(`📝 Opening Kissflow popup for item: ${itemId}`);
    // TODO: Implement popup opening
  } catch (error) {
    console.error("❌ Failed to open Kissflow popup:", error);
  }
}
