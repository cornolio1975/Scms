declare module 'lucide-react' {
  import * as React from 'react';
  export interface LucideProps extends React.SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
    absoluteStrokeWidth?: boolean;
    className?: string;
    children?: React.ReactNode;
  }
  export type Icon = React.ForwardRefExoticComponent<
    React.PropsWithoutRef<LucideProps> & React.RefAttributes<SVGSVGElement>
  >;
  export const Building2: Icon;
  export const GitBranch: Icon;
  export const ShieldCheck: Icon;
  export const ShieldAlert: Icon;
  export const Users: Icon;
  export const Trophy: Icon;
  export const History: Icon;
  export const Save: Icon;
  export const CheckCircle2: Icon;
  export const AlertCircle: Icon;
  export const Plus: Icon;
  export const RefreshCw: Icon;
  export const Edit2: Icon;
  export const ArrowLeft: Icon;
  export const UserCheck: Icon;
  export const MapPin: Icon;
  export const Clock: Icon;
  export const ExternalLink: Icon;
  export const Info: Icon;
  export const Search: Icon;
  export const User: Icon;
  export const Award: Icon;
  export const Shield: Icon;
  export const Filter: Icon;
  export const CalendarCheck2: Icon;
  export const CreditCard: Icon;
  export const Sparkles: Icon;
  export const CheckSquare: Icon;
  export const TrendingUp: Icon;
  export const ArrowRight: Icon;
  export const LayoutDashboard: Icon;
  export const HeartHandshake: Icon;
  export const CalendarDays: Icon;
  export const BarChart3: Icon;
  export const FileText: Icon;
  export const MessageSquare: Icon;
  export const Settings: Icon;
  export const ChevronDown: Icon;
  export const ChevronUp: Icon;
  export const ChevronLeft: Icon;
  export const ChevronRight: Icon;
  export const Menu: Icon;
  export const X: Icon;
  export const LogOut: Icon;
  export const Check: Icon;
  export const [key: string]: any;
}
