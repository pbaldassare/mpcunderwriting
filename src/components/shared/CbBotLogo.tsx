type Props = {
  className?: string;
  alt?: string;
};

export const CB_BOT_LOGO_SRC = "/cb-bot-logo.png";

export default function CbBotLogo({ className = "h-8 w-auto", alt = "CB Bot" }: Props) {
  return <img src={CB_BOT_LOGO_SRC} alt={alt} className={className} draggable={false} />;
}
