const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

/**
 * Express 서버용 보안 미들웨어 설정
 * production 환경에서 사용
 */

// Rate limiting 설정
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// 일반 API 요청 제한 (15분당 100회)
const generalLimiter = createRateLimiter(
  15 * 60 * 1000,
  100,
  '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
);

// 인증 관련 요청 제한 (15분당 5회)
const authLimiter = createRateLimiter(
  15 * 60 * 1000,
  5,
  '너무 많은 로그인 시도가 발생했습니다. 잠시 후 다시 시도해주세요.'
);

// 파일 업로드 요청 제한 (15분당 10회)
const uploadLimiter = createRateLimiter(
  15 * 60 * 1000,
  10,
  '너무 많은 업로드 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
);

/**
 * 보안 미들웨어 적용 함수
 * @param {Express} app Express 애플리케이션 인스턴스
 */
function applySecurityMiddleware(app) {
  // Helmet을 사용한 다양한 보안 헤더 설정
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://www.gstatic.com",
          "https://apis.google.com",
          "https://www.googletagmanager.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:"
        ],
        connectSrc: [
          "'self'",
          "https://*.firebaseio.com",
          "https://*.googleapis.com",
          "wss://*.firebaseio.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com"
        ],
        frameSrc: [
          "'self'",
          "https://*.firebaseapp.com"
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: []
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // XSS 보호
  app.use(xss());

  // NoSQL Injection 방지
  app.use(mongoSanitize());

  // HTTP Parameter Pollution 방지
  app.use(hpp());

  // CORS 설정 (필요한 경우)
  const cors = require('cors');
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200
  }));

  // 요청 크기 제한
  const bodyParser = require('body-parser');
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting 적용
  app.use('/api/', generalLimiter);
  app.use('/api/auth/', authLimiter);
  app.use('/api/upload/', uploadLimiter);

  // CSRF 토큰 검증 미들웨어
  app.use((req, res, next) => {
    // GET 요청은 CSRF 검증 제외
    if (req.method === 'GET') {
      return next();
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || token !== sessionToken) {
      return res.status(403).json({ 
        error: 'Invalid CSRF token' 
      });
    }

    next();
  });

  // 보안 관련 로깅
  app.use((req, res, next) => {
    // 의심스러운 요청 패턴 감지
    const suspiciousPatterns = [
      /(<script|javascript:|onerror|onclick)/i,
      /\.\.\/|\.\.\\/, // Path traversal
      /union.*select|select.*from|insert.*into|delete.*from/i // SQL Injection
    ];

    const requestData = JSON.stringify({
      body: req.body,
      query: req.query,
      params: req.params
    });

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestData)) {
        console.warn('Suspicious request detected:', {
          ip: req.ip,
          method: req.method,
          url: req.url,
          pattern: pattern.toString(),
          timestamp: new Date().toISOString()
        });
        break;
      }
    }

    next();
  });

  // 에러 핸들링 (보안 정보 노출 방지)
  app.use((err, req, res, next) => {
    console.error('Server error:', err);

    // Production에서는 상세 에러 정보 숨기기
    const message = process.env.NODE_ENV === 'production' 
      ? '서버 오류가 발생했습니다.' 
      : err.message;

    res.status(err.status || 500).json({
      error: message
    });
  });
}

module.exports = {
  applySecurityMiddleware,
  generalLimiter,
  authLimiter,
  uploadLimiter
};