import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ClerkAuthGuard } from '../jwt.strategy';

@Injectable()
export class OptionalJwtAuthGuard extends ClerkAuthGuard {
  async canActivate(context: any): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return true;
      }
      throw error;
    }
  }
}
