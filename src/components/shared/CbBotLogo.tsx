type Props = {
  className?: string;
  alt?: string;
};

export const CB_BOT_LOGO_SRC = "/mpc-bot-mark.png";

export default function CbBotLogo({ className = "h-8 w-auto", alt = "MPC Bot" }: Props) {
  return <img src={CB_BOT_LOGO_SRC} alt={alt} className={className} draggable={false} />;
}
