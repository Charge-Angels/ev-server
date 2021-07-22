import Address from './Address';
import { AuthorizationActions } from './Authorization';
import { BillingUserData } from './Billing';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import { ImportStatus } from './GlobalType';
import UserNotifications from './UserNotifications';

export default interface User extends CreatedUpdatedProps, AuthorizationActions {
  id: string;
  issuer: boolean;
  name: string;
  firstName: string;
  email: string;
  phone?: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  locale: string;
  plateID?: string;
  address?: Address;
  image?: string;
  notificationsActive?: boolean;
  notifications?: UserNotifications;
  iNumber?: string;
  costCenter?: string;
  eulaAcceptedHash: string;
  eulaAcceptedVersion: number;
  eulaAcceptedOn: Date;
  password: string;
  passwordResetHash: string;
  passwordWrongNbrTrials: number;
  passwordBlockedUntil: Date;
  verificationToken?: string;
  verifiedAt?: Date;
  billingData?: BillingUserData;
  mobileOs: string;
  mobileToken: string;
  mobileLastChangedOn: Date;
  lastSelectedCarID?: string;
  authorizationID?: string;
  importedData?: {
    autoActivateUserAtImport: boolean;
    autoActivateTagAtImport: boolean;
  };
}

export interface UserSite {
  user: User;
  userID?: string;
  siteID: string;
  siteAdmin: boolean;
  siteOwner: boolean;
}

export interface ImportedUser {
  id?: string;
  name: string;
  firstName: string;
  email: string;
  importedBy?: string;
  importedOn?: Date;
  status?: ImportStatus
  errorDescription?: string;
  importedData?: {
    autoActivateUserAtImport: boolean;
    autoActivateTagAtImport: boolean;
  };
  siteIDs?: string;
}

export enum UserStatus {
  PENDING = 'P',
  ACTIVE = 'A',
  INACTIVE = 'I',
  BLOCKED = 'B',
  LOCKED = 'L',
}

export enum UserRole {
  SUPER_ADMIN = 'S',
  ADMIN = 'A',
  BASIC = 'B',
  DEMO = 'D',
}

export const UserRequiredImportProperties = [
  'email',
  'firstName',
  'name'
];

