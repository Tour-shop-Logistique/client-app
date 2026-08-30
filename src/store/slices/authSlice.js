import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authService from '../../services/authService';

// Guests can browse the whole app; `isAuthenticated` only gates the moment they
// validate an expedition or a marketplace order (cahier 4.1). Auth itself is
// email-based: register -> verify-email -> login (see api-authentification-client.md).
const initialState = {
  user: authService.getStoredUser(),
  token: authService.getStoredToken(),
  isAuthenticated: Boolean(authService.getStoredToken()),
  // idle | loading | error — plus flow flags below
  status: 'idle',
  error: null,
  fieldErrors: null,
  // email awaiting an email-verification code or a password-reset code
  pendingEmail: null,
  emailVerified: false,
  resetCodeVerified: false,
};

const failure = (err, fallback) => ({
  message: err.response?.data?.message || fallback,
  fieldErrors: err.response?.data?.errors || null,
});

export const registerClient = createAsyncThunk(
  'auth/registerClient',
  async (form, { rejectWithValue }) => {
    try {
      await authService.register(form);
      return { email: form.email };
    } catch (err) {
      return rejectWithValue(failure(err, "Impossible de créer le compte."));
    }
  }
);

export const verifyEmailCode = createAsyncThunk(
  'auth/verifyEmailCode',
  async ({ email, code }, { rejectWithValue }) => {
    try {
      const data = await authService.verifyEmail({ email, code });
      return { email, message: data?.message };
    } catch (err) {
      return rejectWithValue(failure(err, 'Code invalide ou expiré.'));
    }
  }
);

export const resendVerification = createAsyncThunk(
  'auth/resendVerification',
  async (email, { rejectWithValue }) => {
    try {
      const data = await authService.resendEmailVerification(email);
      return { message: data?.message };
    } catch (err) {
      return rejectWithValue(failure(err, "Impossible de renvoyer le code."));
    }
  }
);

export const loginClient = createAsyncThunk(
  'auth/loginClient',
  async ({ email, telephone, password }, { rejectWithValue }) => {
    try {
      const data = await authService.login({ email, telephone, password });
      return data;
    } catch (err) {
      return rejectWithValue(failure(err, 'Les identifiants fournis sont incorrects.'));
    }
  }
);

// Restore a session at app boot from a stored token.
export const restoreSession = createAsyncThunk(
  'auth/restoreSession',
  async (_, { rejectWithValue }) => {
    try {
      const data = await authService.fetchProfile();
      return data.user;
    } catch {
      return rejectWithValue(null);
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (email, { rejectWithValue }) => {
    try {
      const data = await authService.forgotPassword(email);
      // Unknown email -> HTTP 200 but success: false. Treat as an error here.
      if (!data?.success) {
        return rejectWithValue({
          message: data?.message || 'Aucun compte trouvé avec cette adresse e-mail.',
          fieldErrors: null,
        });
      }
      return { email, message: data.message };
    } catch (err) {
      return rejectWithValue(failure(err, "Impossible d'envoyer le code de réinitialisation."));
    }
  }
);

export const verifyResetCode = createAsyncThunk(
  'auth/verifyResetCode',
  async ({ email, code }, { rejectWithValue }) => {
    try {
      const data = await authService.verifyResetCode({ email, code });
      if (!data?.success) {
        return rejectWithValue({ message: data?.message || 'Code invalide ou expiré.', fieldErrors: null });
      }
      return { message: data.message };
    } catch (err) {
      return rejectWithValue(failure(err, 'Code invalide ou expiré.'));
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ email, code, password, passwordConfirmation }, { rejectWithValue }) => {
    try {
      const data = await authService.resetPassword({ email, code, password, passwordConfirmation });
      return { message: data?.message };
    } catch (err) {
      return rejectWithValue(failure(err, 'Impossible de réinitialiser le mot de passe.'));
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  await authService.logout();
});

const clearAuth = (state) => {
  state.user = null;
  state.token = null;
  state.isAuthenticated = false;
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Local-only sign-out, e.g. after a 401 from the API interceptor.
    sessionExpired(state) {
      authService.clearSession();
      clearAuth(state);
    },
    resetAuthFlow(state) {
      state.status = 'idle';
      state.error = null;
      state.fieldErrors = null;
      state.pendingEmail = null;
      state.emailVerified = false;
      state.resetCodeVerified = false;
    },
    clearAuthError(state) {
      state.error = null;
      state.fieldErrors = null;
    },
    setPendingEmail(state, action) {
      state.pendingEmail = action.payload;
    },
  },
  extraReducers: (builder) => {
    const pending = (state) => {
      state.status = 'loading';
      state.error = null;
      state.fieldErrors = null;
    };
    const rejected = (state, action) => {
      state.status = 'error';
      state.error = action.payload?.message || 'Une erreur est survenue.';
      state.fieldErrors = action.payload?.fieldErrors || null;
    };

    builder
      .addCase(registerClient.pending, pending)
      .addCase(registerClient.fulfilled, (state, action) => {
        state.status = 'idle';
        state.pendingEmail = action.payload.email;
        state.emailVerified = false;
      })
      .addCase(registerClient.rejected, rejected)

      .addCase(verifyEmailCode.pending, pending)
      .addCase(verifyEmailCode.fulfilled, (state) => {
        state.status = 'idle';
        state.emailVerified = true;
      })
      .addCase(verifyEmailCode.rejected, rejected)

      .addCase(resendVerification.pending, pending)
      .addCase(resendVerification.fulfilled, (state) => {
        state.status = 'idle';
      })
      .addCase(resendVerification.rejected, rejected)

      .addCase(loginClient.pending, pending)
      .addCase(loginClient.fulfilled, (state, action) => {
        state.status = 'idle';
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.pendingEmail = null;
        state.emailVerified = false;
        state.resetCodeVerified = false;
      })
      .addCase(loginClient.rejected, rejected)

      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(restoreSession.rejected, (state) => {
        authService.clearSession();
        clearAuth(state);
      })

      .addCase(forgotPassword.pending, pending)
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.status = 'idle';
        state.pendingEmail = action.payload.email;
        state.resetCodeVerified = false;
      })
      .addCase(forgotPassword.rejected, rejected)

      .addCase(verifyResetCode.pending, pending)
      .addCase(verifyResetCode.fulfilled, (state) => {
        state.status = 'idle';
        state.resetCodeVerified = true;
      })
      .addCase(verifyResetCode.rejected, rejected)

      .addCase(resetPassword.pending, pending)
      .addCase(resetPassword.fulfilled, (state) => {
        state.status = 'idle';
        state.pendingEmail = null;
        state.resetCodeVerified = false;
      })
      .addCase(resetPassword.rejected, rejected)

      .addCase(logout.fulfilled, clearAuth)
      .addCase(logout.rejected, clearAuth);
  },
});

export const { sessionExpired, resetAuthFlow, clearAuthError, setPendingEmail } = authSlice.actions;
export default authSlice.reducer;
