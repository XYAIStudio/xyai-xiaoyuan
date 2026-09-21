const OCTOP_ZH: Record<string, string> = {
  AUTH_FAILED: "用户名或密码错误。请核对 FreeOS 账户后重试",
  ACCOUNT_REQUIRED: "需要先创建账户。请在浏览器打开 FreeOS 完成初始化向导",
  TOKEN_EXPIRED: "登录已过期，请再点一次「测试连接」",
  SETUP_REQUIRED:
    "FreeOS 尚未完成初始化。请先在浏览器打开 http://127.0.0.1:8088 走完向导",
  FORBIDDEN: "没有权限访问该接口",
  NOT_FOUND: "接口不存在。请确认地址是 FreeOS（默认 http://127.0.0.1:8088）且版本匹配",
  USER_DISABLED: "该账户已禁用",
  LOGIN_LOCKED: "登录次数过多，账户已锁定。请稍后再试或在 FreeOS 里解锁",
  SETUP_PASSWORD_WRONG: "初始化向导密码不正确",
  SETUP_RATE_LIMITED: "向导尝试次数过多，请稍后再试",
  SETUP_TOKEN_INVALID: "初始化会话已失效，请重新打开 FreeOS 向导",
  AGENT_NOT_FOUND: "找不到该智能体",
  AGENT_NOT_RUNNING: "智能体未运行，请先在 FreeOS 里启动它",
  AGENT_BUSY: "智能体正忙，请稍后再试",
};

const HTTP_ZH: Record<number, string> = {
  400: "请求无效，请检查填写的地址、用户名和密码",
  401: "未授权。请检查用户名和密码是否正确",
  403: "没有权限访问该接口",
  404: "接口不存在。请确认地址是 FreeOS（默认 :8088），不要改成 openXYOS :3000",
  409: "FreeOS 可能尚未完成初始化，请先在浏览器打开 :8088 走完向导",
  410: "资源已失效或初始化状态已变化，请刷新后重试",
  413: "请求体过大",
  429: "请求过于频繁，请稍后再试",
  500: "FreeOS 内部错误。请查看其后端日志",
  502: "网关错误，后端可能刚启动或未就绪",
  503: "服务暂不可用，请确认 FreeOS 已完成启动",
};

export function describeHttpStatus(status: number): string | null {
  return HTTP_ZH[status] ?? (status >= 500 ? HTTP_ZH[500] : null);
}

export function describeOctopCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return OCTOP_ZH[code] ?? null;
}

function looksEnglishTechnical(message: string): boolean {
  return /invalid credentials|initial admin not created|setup already completed|not found|forbidden|unauthorized/i.test(
    message,
  );
}

function httpLike(
  error: unknown,
): error is { status: number; body?: string; code?: string; message: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  );
}

function codeFromBody(body: string | undefined): string | null {
  if (!body) return null;
  try {
    const data = JSON.parse(body) as { error?: { code?: unknown } };
    if (data?.error && typeof data.error.code === "string") {
      return data.error.code.trim() || null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function messageFromBody(body: string | undefined): string | null {
  if (!body) return null;
  try {
    const data = JSON.parse(body) as {
      detail?: unknown;
      message?: unknown;
      error?: { message?: unknown } | string;
    };
    if (
      data?.error &&
      typeof data.error === "object" &&
      typeof data.error.message === "string"
    ) {
      return data.error.message.trim() || null;
    }
    if (typeof data.detail === "string") return data.detail.trim() || null;
    if (typeof data.message === "string") return data.message.trim() || null;
  } catch {
    /* ignore */
  }
  return null;
}

export function describeProviderError(error: unknown): string {
  if (httpLike(error)) {
    const byCode = describeOctopCode(error.code || codeFromBody(error.body));
    if (byCode) return byCode;
    const parsed = messageFromBody(error.body) || error.message;
    if (parsed && !looksEnglishTechnical(parsed) && !/^HTTP \d+/.test(parsed)) {
      return parsed;
    }
    if (/invalid credentials/i.test(parsed)) return OCTOP_ZH.AUTH_FAILED;
    if (/initial admin not created|setup required/i.test(parsed)) {
      return OCTOP_ZH.SETUP_REQUIRED;
    }
    return describeHttpStatus(error.status) || `HTTP ${error.status}`;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid credentials/i.test(message)) return OCTOP_ZH.AUTH_FAILED;
  if (/initial admin not created|setup_required|setup required/i.test(message)) {
    return OCTOP_ZH.SETUP_REQUIRED;
  }
  if (/请先在设置中填写/.test(message)) return message;
  if (/登录响应缺少/.test(message)) {
    return "登录响应缺少 access_token。请确认这是 FreeOS（:8088），账号是否正确";
  }
  return message;
}
