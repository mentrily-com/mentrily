import { CertificateService } from './certificate.service';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../services/supabase/supabase.service';
import { StorageService } from '../../services/storage/storage.service';

describe('CertificateService', () => {
  let service: CertificateService;

  beforeEach(() => {
    service = new CertificateService(
      {} as SupabaseService,
      {} as StorageService,
      {} as ConfigService,
    );
  });

  describe('isPrivateIP', () => {
    it('should correctly identify private IPv4 addresses', () => {
      // @ts-ignore
      expect(service.isPrivateIP('10.0.0.1')).toBe(true);
      // @ts-ignore
      expect(service.isPrivateIP('172.16.0.1')).toBe(true);
      // @ts-ignore
      expect(service.isPrivateIP('172.31.255.255')).toBe(true);
      // @ts-ignore
      expect(service.isPrivateIP('192.168.1.1')).toBe(true);
      // @ts-ignore
      expect(service.isPrivateIP('127.0.0.1')).toBe(true);
      // @ts-ignore
      expect(service.isPrivateIP('0.0.0.0')).toBe(true);
      // @ts-ignore
      expect(service.isPrivateIP('169.254.169.254')).toBe(true);

      // @ts-ignore
      expect(service.isPrivateIP('8.8.8.8')).toBe(false);
      // @ts-ignore
      expect(service.isPrivateIP('1.1.1.1')).toBe(false);
      // @ts-ignore
      expect(service.isPrivateIP('172.32.0.1')).toBe(false); // Outside 172.16-31
    });
  });
});
