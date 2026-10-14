// 서버가 enum 값을 늘려도 타입 오류가 나지 않게 모르는 문자열도 받는다.
type OpenString = string & {};

export type AccountRole = 'ROOT' | 'ADMIN' | 'USER' | OpenString;
export type AccountStatus = 'PENDING' | 'ACTIVE' | OpenString;
export type AccountObjectType = 'STUDENT' | 'TEACHER' | OpenString;
export type Sex = 'MAN' | 'WOMAN' | OpenString;
export type Major = 'SW_DEVELOPMENT' | 'SMART_IOT' | 'AI' | OpenString;
export type StudentRole =
  | 'STUDENT_COUNCIL'
  | 'DORMITORY_MANAGER'
  | 'GENERAL_STUDENT'
  | 'GRADUATE'
  | 'WITHDRAWN'
  | OpenString;
export type TeacherDepartment =
  | 'MEISTER'
  | 'DORMITORY'
  | 'GRADE'
  | 'ACADEMIC_AFFAIRS'
  | 'PROFESSIONAL_EDUCATION'
  | 'EMPLOYMENT_CAREER'
  | 'ADMINISTRATION'
  | OpenString;
export type ClubType = 'MAJOR_CLUB' | 'AUTONOMOUS_CLUB' | OpenString;

export interface DataGsmClubSummary {
  id: number;
  name: string;
  type: ClubType;
}

export interface DataGsmProjectSummary {
  id: number;
  name: string;
  status: string;
  club: DataGsmClubSummary | null;
}

export interface DataGsmStudent {
  id: number;
  name: string;
  sex: Sex;
  email: string;
  grade: number | null;
  classNum: number | null;
  number: number | null;
  studentNumber: number | null;
  major: Major | null;
  specialty: string | null;
  role: StudentRole;
  dormitoryFloor: number | null;
  dormitoryRoom: number | null;
  majorClub: DataGsmClubSummary | null;
  autonomousClub: DataGsmClubSummary | null;
  githubId: string | null;
  githubUrl: string | null;
}

export interface DataGsmTeacher {
  id: number;
  name: string;
  email: string;
  department: TeacherDepartment;
  description: string | null;
}

/** `/userinfo` 응답입니다. */
export interface DataGsmUser {
  id: number;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  objectType: AccountObjectType | null;
  /** @deprecated `objectType === 'STUDENT'`를 사용하세요. */
  isStudent: boolean;
  student: DataGsmStudent | null;
  teacher: DataGsmTeacher | null;
  /** 운영 서버에는 아직 없는 필드입니다. */
  clubs?: DataGsmClubSummary[];
  /** 운영 서버에는 아직 없는 필드입니다. */
  projects?: DataGsmProjectSummary[];
}

/** `/v1/oauth/token` 응답입니다. */
export interface TokenSet {
  accessToken: string;
  tokenType: string;
  /** 초 단위입니다. */
  expiresIn: number;
  refreshToken: string | null;
  /** 공백으로 구분된 문자열입니다. */
  scope: string;
  /** `openid` scope를 요청했을 때만 있습니다. 운영 서버는 아직 발급하지 않습니다. */
  idToken?: string | null;
}

export interface DataGsmAuthConfig {
  clientId: string;
  /**
   * 넣으면 토큰 요청에 함께 보냅니다. 로그인은 항상 PKCE를 쓰므로 생략해도 됩니다.
   */
  clientSecret?: string;
  /**
   * DataGSM 클라이언트에 등록한 리다이렉트 URL입니다. 경로는 `${basePath}/callback`이어야 합니다.
   * 프록시 뒤에서도 정확하도록 요청 주소에서 추론하지 않고 이 값의 origin을 앱 주소로 씁니다.
   */
  redirectUri: string;
  /** 쿠키 암호화 키를 만드는 비밀값입니다. 32자 이상이어야 합니다. */
  sessionSecret: string;
  /** 요청할 scope 목록입니다. 생략하면 서버 기본값을 따릅니다. */
  scope?: readonly string[];
  /** 인증 라우트의 경로입니다. 기본값은 `/api/auth`입니다. */
  basePath?: string;
  /** 세션 쿠키 수명(초)입니다. 기본값은 7일입니다. */
  sessionMaxAge?: number;
  /** 로그인에 실패하면 `?error=코드`를 붙여 이 경로로 보냅니다. 기본값은 `/`입니다. */
  errorPath?: string;
  /** 인가 서버 주소입니다. 기본값은 `https://oauth.authorization.datagsm.kr`입니다. */
  issuer?: string;
  /** 사용자 정보 엔드포인트입니다. 기본값은 `https://oauth.resource.datagsm.kr/userinfo`입니다. */
  userInfoUrl?: string;
}
