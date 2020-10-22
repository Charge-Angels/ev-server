import Address from './Address';
import { BillingUserData } from './Billing';
import { Car } from './Car';
import CreatedUpdatedProps from './CreatedUpdatedProps';
import Tag from './Tag';
import UserNotifications from './UserNotifications';

export default interface User extends CreatedUpdatedProps {
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
  deleted: boolean;
  eulaAcceptedHash: string;
  eulaAcceptedVersion: number;
  eulaAcceptedOn: Date;
  password: string;
  passwordResetHash: string;
  passwordWrongNbrTrials: number;
  passwordBlockedUntil: Date;
  verificationToken?: string;
  verifiedAt?: Date;
  tags?: Tag[];
  billingData?: BillingUserData;
  mobileOs: string;
  mobileToken: string;
  mobileLastChangedOn: Date;
  lastSelectedCarID?: string;
}

export interface UserSite {
  user: User;
  siteID: string;
  siteAdmin: boolean;
  siteOwner: boolean;
}

export interface UserDefaultTagCar {
  car?: Car;
  tag?: Tag;
}

export interface UserCar extends CreatedUpdatedProps {
  id?: string;
  user: User;
  carID: string;
  default?: boolean;
  owner?: boolean;
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

