import { Injectable } from '@nestjs/common';
import { ClerkAuthGuard } from '../jwt.strategy';

@Injectable()
export class JwtAuthGuard extends ClerkAuthGuard {}
