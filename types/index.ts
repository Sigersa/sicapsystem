export type UserData = {
  SystemUserID: number;
  UserName: string;
  UserTypeID: number;
  UserType: string;
  EmployeeID: number;
  EmployeeName: string;
  EmployeeEmail: string;
};

export type UserType = {
  UserTypeID: number;
  Type: string;
};

export type Employee = {
  EmployeeID: number;
  FullName: string;
  Email: string;
};