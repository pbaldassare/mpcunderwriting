import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";

const schema = z.object({
  data_evento: z.string().min(1, "La data accadimento è obbligatoria"),
});

function TestForm({ onValid }: { onValid: () => void }) {
  const { register, trigger, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { data_evento: "" },
  });

  return (
    <div>
      <Input type="date" id="data_evento" {...register("data_evento")} />
      {errors.data_evento && <p role="alert">{errors.data_evento.message}</p>}
      <button
        type="button"
        onClick={async () => {
          const ok = await trigger("data_evento");
          if (ok) onValid();
        }}
      >
        Avanti
      </button>
      <output data-testid="value">{getValues("data_evento")}</output>
    </div>
  );
}

describe("DateInput with react-hook-form register", () => {
  it("commits typed dd/MM/yyyy as ISO and passes trigger", async () => {
    const onValid = vi.fn();
    render(<TestForm onValid={onValid} />);

    const input = screen.getByPlaceholderText("gg/mm/aaaa") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "01/07/2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Avanti" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(onValid).toHaveBeenCalled();
    expect(screen.getByTestId("value").textContent).toBe("2026-07-01");
  });

  it("trigger immediately after change keeps ISO value (wizard Avanti race)", async () => {
    let triggerFn: ((name: "data_evento") => Promise<boolean>) | undefined;
    function ImmediateTriggerForm() {
      const { register, trigger, getValues, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
        defaultValues: { data_evento: "" },
      });
      triggerFn = trigger;
      return (
        <div>
          <Input type="date" {...register("data_evento")} />
          {errors.data_evento && <p role="alert">{errors.data_evento.message}</p>}
          <output data-testid="value">{getValues("data_evento")}</output>
        </div>
      );
    }
    render(<ImmediateTriggerForm />);

    const input = screen.getByPlaceholderText("gg/mm/aaaa") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "01/07/2026" } });
    const ok = await triggerFn!("data_evento");

    expect(ok).toBe(true);
    expect(screen.getByTestId("value").textContent).toBe("2026-07-01");
  });

  it("RHF blur keeps ISO, not Italian display text", async () => {
    let getValuesFn: (() => string) | undefined;
    function BlurForm() {
      const { register, getValues } = useForm({
        defaultValues: { data_evento: "" },
      });
      getValuesFn = () => getValues("data_evento");
      return <Input type="date" {...register("data_evento")} />;
    }
    render(<BlurForm />);

    const input = screen.getByPlaceholderText("gg/mm/aaaa") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "01/07/2026" } });
    fireEvent.blur(input);

    expect(getValuesFn!()).toBe("2026-07-01");
  });

  it("commits digit-only typing with auto slashes as ISO", async () => {
    const onValid = vi.fn();
    render(<TestForm onValid={onValid} />);

    const input = screen.getByPlaceholderText("gg/mm/aaaa") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "01072026" } });
    fireEvent.click(screen.getByRole("button", { name: "Avanti" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(onValid).toHaveBeenCalled();
    expect(input.value).toBe("01/07/2026");
    expect(screen.getByTestId("value").textContent).toBe("2026-07-01");
  });
});
