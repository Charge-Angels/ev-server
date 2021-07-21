export interface HttpDatabaseProjectRequest {
  ProjectFields?: string;
}
export default interface HttpDatabaseRequest extends HttpDatabaseProjectRequest {
  Skip?: number;
  Limit?: number;
  OnlyRecordCount?: boolean;
  SortFields: any;
  WithUser: boolean;
}

