import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";

// 自定义响应类型接口
export interface CustomResponse<T = any> {
  code: number;
  message: string;
  result: T;
  status: "success" | "error" | "fail";
}

export interface CustomErrorResponse {
  code: number;
  message: string;
  path: string;
  timestamp: Date;
}

class AxiosWrapper {
  private static instance: AxiosWrapper;
  axiosInstance: AxiosInstance;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: "",
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  public static getInstance(): AxiosWrapper {
    if (!AxiosWrapper.instance) {
      AxiosWrapper.instance = new AxiosWrapper();
    }
    return AxiosWrapper.instance;
  }

  public setupInterceptors() {
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // (config: any) => {
        // 请求拦截逻辑
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse<CustomResponse>) => {
        // 响应拦截逻辑
        return response;
      },
      (error: AxiosError<CustomErrorResponse & { redirectUrl?: string }>) => {
        // session 过期：后端返回 401 + { code: 302, redirectUrl }，跳转到登录页
        const data = error.response?.data;
        if (data && data.code === 302 && data.redirectUrl) {
          window.open(data.redirectUrl, "_self");
          return new Promise(() => {});
        }
        return Promise.reject(error);
      },
    );
  }

  public setHeaders(headers: Record<string, string>) {
    Object.assign(this.axiosInstance.defaults.headers.common, headers);
  }

  public async get<T = any, R = CustomResponse<T>>(url: string, config?: AxiosRequestConfig): Promise<R> {
    const response = await this.axiosInstance.get<R>(url, config);
    return response.data;
  }

  public async post<T = any, D = any, R = CustomResponse<T>>(url: string, data?: D, config?: AxiosRequestConfig): Promise<R> {
    const response = await this.axiosInstance.post<R>(url, data, config);
    return response.data;
  }

  public async put<T = any, D = any, R = CustomResponse<T>>(url: string, data?: D, config?: AxiosRequestConfig): Promise<R> {
    const response = await this.axiosInstance.put<R>(url, data, config);
    return response.data;
  }

  public async delete<T = any, D = any, R = CustomResponse<T>>(url: string, data?: D, config?: AxiosRequestConfig): Promise<R> {
    const _config = {
      data,
      ...config,
    };
    const response = await this.axiosInstance.delete<R>(url, _config);
    return response.data;
  }
}

const $http = AxiosWrapper.getInstance();

export default $http;
