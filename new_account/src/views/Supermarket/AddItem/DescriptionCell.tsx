import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Autocomplete, TextField } from "@mui/material";
import { existingNameMatches, singlishSuggestions } from "../../../utils/singlishSuggest";
import { googleSinhalaSuggestions } from "../../../utils/googleInputTools";

const IN_SYSTEM = "Already in the system";
const FROM_GOOGLE = "Google suggestions";
const BUILT_IN = "Other spellings";

type Props = {
  value: string;
  existingNames: string[];
  onChange: (value: string) => void;
};

export default function DescriptionCell({ value, existingNames, onChange }: Props) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), 250);
    return () => clearTimeout(t);
  }, [value]);

  const { data: google } = useQuery({
    queryKey: ["singlish-google", settled],
    queryFn: ({ signal }) => googleSinhalaSuggestions(settled, signal),
    enabled: settled.trim().length >= 2 && /^[A-Za-z][A-Za-z ]*$/.test(settled.trim()),
    staleTime: Infinity,
    retry: false,
  });

  const { options, groupOf } = useMemo(() => {
    const group = new Map<string, string>();
    const add = (words: string[], name: string) => {
      for (const w of words) if (w && !group.has(w)) group.set(w, name);
    };
    add(existingNameMatches(existingNames, value), IN_SYSTEM);
    add(google ?? [], FROM_GOOGLE);
    add(singlishSuggestions(value, google?.length ? 10 : 25), BUILT_IN);

    const order = [IN_SYSTEM, FROM_GOOGLE, BUILT_IN];
    const sorted = [...group.keys()].sort(
      (a, b) => order.indexOf(group.get(a)!) - order.indexOf(group.get(b)!),
    );
    return { options: sorted, groupOf: group };
  }, [existingNames, google, value]);

  return (
    <Autocomplete
      freeSolo
      options={options}
      groupBy={(o) => groupOf.get(o) ?? BUILT_IN}
      filterOptions={(o) => o}
      inputValue={value}
      onInputChange={(_e, val) => onChange(val)}
      onChange={(_e, val) => { if (val) onChange(val); }}
      renderInput={(params) => (
        <TextField {...params} size="small" inputProps={{ ...params.inputProps, style: { width: 190 } }} />
      )}
    />
  );
}
