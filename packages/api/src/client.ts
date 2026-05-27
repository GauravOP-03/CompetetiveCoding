import "dotenv/config";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const BASE_URL = process.env.BACKEND_URL || "http://localhost:3001";

let inMemoryToken: string | null = null;
export const setToken = (token: string) => {
  inMemoryToken = token;
};
export const clearToken = () => {
  inMemoryToken = null;
};

export const authApi = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

const api = axios.create({
  baseURL: BASE_URL,
});

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface FailedRequest {
  resolve: (value: string | null) => void;
  reject: (reason?: any) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (inMemoryToken) {
      config.headers["authorization"] = `Bearer ${inMemoryToken}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (
      error.response?.status == 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) {
              originalRequest.headers["authorization"] = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await authApi.post("/auth/refresh");
        console.log(refreshResponse);
        const newAccessToken = refreshResponse.data.access_token;
        inMemoryToken = newAccessToken;
        processQueue(null, newAccessToken);
        originalRequest.headers["authorization"] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (e) {
        const err = e as Error;
        processQueue(err, null);
        inMemoryToken = null;
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
