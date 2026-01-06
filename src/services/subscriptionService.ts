import apiFetch from '../lib/api';

export interface SubscriptionStatus {
  is_vip: boolean;
  subscriptionStatus: string; // 'active', 'expired', 'free'
  subscriptionExpiresAt: string | null;
}

export interface BindSubscriptionResponse {
  success: boolean;
  message?: string;
  error?: string;
  subscriptionStatus?: string;
  subscriptionExpiresAt?: string;
}

export const subscriptionService = {
  /**
   * Fetches the current user's subscription status.
   */
  getStatus: async (): Promise<SubscriptionStatus | null> => {
    try {
      const response = await apiFetch('/user/status');
      if (!response.ok) {
        console.error('Failed to fetch subscription status');
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      return null;
    }
  },

  /**
   * Binds an App Store receipt to the user's account.
   * @param phone The user's phone number (optional, logic handled by token usually)
   * @param receipt The Base64 encoded receipt string
   */
  bindReceipt: async (receipt: string, phone?: string): Promise<BindSubscriptionResponse> => {
    try {
      const response = await apiFetch('/subscription/bind', {
        method: 'POST',
        body: JSON.stringify({
          phone, // Optional, backend might rely on token
          receipt,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to bind subscription',
        };
      }

      return data;
    } catch (error: any) {
      console.error('Error binding receipt:', error);
      return {
        success: false,
        error: error.message || 'Network error',
      };
    }
  },

  /**
   * Orchestrates the purchase restoration/binding flow.
   * 1. Gets the local receipt from Electron.
   * 2. Gets current user info (phone) from store/context.
   * 3. Sends receipt + phone to the backend.
   */
  restorePurchase: async (): Promise<{ success: boolean; message: string }> => {
    try {
      // 1. Get Receipt
      // @ts-ignore
      const receipt = await window.electron.getAppStoreReceipt();
      
      if (!receipt) {
        return { success: false, message: 'No receipt found on this device.' };
      }

      // 2. Get User Info (Phone)
      // We need to fetch the profile first to ensure we have the phone number
      // In a real app, this might come from a robust auth store
      let phone: string | undefined;
      try {
        const userResponse = await apiFetch('/profile');
        if (userResponse.ok) {
            const userData = await userResponse.json();
            phone = userData.phoneNumber;
        }
      } catch (e) {
        console.error('Failed to fetch user profile for phone number', e);
      }

      if (!phone) {
          return { success: false, message: 'Could not retrieve user phone number for binding.' };
      }

      // 3. Bind to Backend
      const result = await subscriptionService.bindReceipt(receipt, phone);

      if (result.success) {
        return { success: true, message: 'Subscription restored successfully.' };
      } else {
        return { success: false, message: result.error || 'Failed to restore subscription.' };
      }
    } catch (error: any) {
      return { success: false, message: error.message || 'Unknown error during restoration.' };
    }
  }
};
