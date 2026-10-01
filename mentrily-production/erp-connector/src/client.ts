import axios, { AxiosInstance } from 'axios';

export interface ErpNextConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
}

export class ErpNextClient {
  private readonly http: AxiosInstance;

  constructor(private readonly config: ErpNextConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl.replace(/\/+$/, ''),
      headers: {
        Authorization: `token ${config.apiKey}:${config.apiSecret}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  async getDoc(doctype: string, name: string) {
    const res = await this.http.get(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
    return res.data.data;
  }

  async createDoc(doctype: string, data: Record<string, unknown>) {
    const res = await this.http.post(`/api/resource/${encodeURIComponent(doctype)}`, data);
    return res.data.data;
  }

  async updateDoc(doctype: string, name: string, data: Record<string, unknown>) {
    const res = await this.http.put(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, data);
    return res.data.data;
  }

  async syncStudent(studentData: { email: string; name: string; rollNumber?: string; department?: string }) {
    return this.createDoc('Student', {
      student_email_id: studentData.email,
      first_name: studentData.name,
      roll_number: studentData.rollNumber,
      department: studentData.department,
    });
  }

  async enrollProgram(studentDocName: string, programDocName: string, academicYear?: string) {
    return this.createDoc('Program Enrollment', {
      student: studentDocName,
      program: programDocName,
      academic_year: academicYear || new Date().getFullYear().toString(),
    });
  }
}
